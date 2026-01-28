/** biome-ignore-all lint/style/noNonNullAssertion: done responsibly */
import type {
  EmptyNode,
  Image,
  ImageReference,
  IPlugin,
  Optional,
  Parent,
  PhrasingContent,
  Root,
  RootContent,
  SVG,
} from "../../core/src";
import {
  type CacheConfigType,
  createPersistentCache,
  simpleCleanup,
} from "../../core/src/utils/cache";
import type { Definitions } from "../../core/src/utils";
import type { IImageOptions } from "docx";
import { fixGeneratedSvg, handleSvg } from "./svg-utils";
import { getImageMimeType, getPlaceHolderImage } from "./utils";

/**
 * List of supported image MIME types that can be embedded directly in DOCX.
 * SVG is intentionally excluded due to its special handling.
 */
const SUPPORTED_IMAGE_TYPES = ["jpeg", "jpg", "bmp", "gif", "png"] as const;

/** namespace used for cleaning up the idb cache */
const NAMESPACE = "img";

/**
 * A resolver function that transforms an image `src` into
 * a `docx`-compatible `IImageOptions` object.
 *
 * @param src - Base64 or URL image source.
 * @param options - Current plugin options.
 * @param node - Image or SVG node in the Markdown AST.
 */
export type ImageResolver = (
  src: string,
  options: IDefaultImagePluginOptions,
  node?: Image | SVG,
) => Promise<IImageOptions>;

/**
 * Full configuration for the image plugin including defaulted and required options.
 */
export interface IDefaultImagePluginOptions {
  /** Scale factor for base64 (data URL) images. @default 3 */
  scale: number;

  /** Fallback format to convert unsupported image types. @default "png" */
  fallbackImageType: "png" | "jpg";

  /** Quality factor (0–1). Applies only to lossy formats (`jpeg`/`webp`/`avif`). Default: `0.92`. */
  quality: number;

  /** Image resolution function used to convert URL/base64/SVG to image options */
  imageResolver: ImageResolver;

  /** Max image width (in inches) for inserted image */
  maxW: number;

  /** Max image height (in inches) for inserted image */
  maxH: number;

  /** Optional placeholder image (base64 or URL) used on errors */
  placeholder?: string;

  /**
   * In-memory cache object, useful for cache sharing across plugins/tabs.
   */
  cache?: Record<string, Promise<unknown>>;

  /** Configure caching */
  cacheConfig?: CacheConfigType<IImageOptions>;

  /**
   * Optional salt string used to differentiate cache keys for similar images (e.g., dark/light theme).
   */
  salt?: string;

  /** Target resolution in DPI for calculating physical dimensions */
  dpi: number;

  /** Duration in minutes after which cached records are removed as stale. Default: 7 days (10080 minutes). */
  maxAgeMinutes: number;

  /**
   * Applies generic fixes to known SVG rendering issues (e.g., Mermaid pie chart title alignment).
   * Designed to be overridden to handle tool-specific quirks in generated SVGs.
   *
   * @param svg - Raw SVG string to transform.
   * @param metadata - Optional metadata such as diagram type or render info.
   * @returns Modified SVG string.
   */

  // biome-ignore lint/suspicious/noExplicitAny: ok - coming from mermaid
  fixGeneratedSvg: (svg: string, metadata: any) => string;
}

/**
 * External plugin options accepted by consumers, omitting internal-only values.
 */
export type IImagePluginOptions = Optional<
  Omit<IDefaultImagePluginOptions, "dpi">
>;

/**
 * Handles base64 data URL images. Returns image options suitable for DOCX.
 * Converts unsupported types to canvas-based fallback.
 */
const handleDataUrls = async (
  src: string,
  options: IDefaultImagePluginOptions,
): Promise<IImageOptions> => {
  const scaleFactor = options.scale;
  const imgType = src.split(";")[0].split("/")[1];

  const img = new Image();
  img.src = src;
  await new Promise((resolve) => {
    img.onload = resolve;
  });

  const width = img.width * scaleFactor;
  const height = img.height * scaleFactor;

  // skipcq: JS-0323
  // biome-ignore lint/suspicious/noExplicitAny: ok
  if (SUPPORTED_IMAGE_TYPES.includes(imgType as any)) {
    return {
      data: src,
      // @ts-expect-error -- imgType is known to be supported
      type: imgType,
      transformation: {
        width: width / scaleFactor,
        height: height / scaleFactor,
      },
    };
  }

  /* v8 ignore start */
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) throw new Error("Canvas context not available");

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(img, 0, 0, width, height);
  const fallbackImageType = options.fallbackImageType ?? "png";

  return {
    data: canvas.toDataURL(
      `image/${fallbackImageType === "jpg" ? "jpeg" : fallbackImageType}`,
    ),
    type: fallbackImageType,
    transformation: {
      width: width / scaleFactor,
      height: height / scaleFactor,
    },
  };
  /* v8 ignore stop */
};

/**
 * Fetches and processes external image URLs.
 * Automatically detects SVGs and delegates them to SVG handler.
 */
const handleNonDataUrls = async (
  url: string,
  options: IDefaultImagePluginOptions,
): Promise<IImageOptions> => {
  const response = await fetch(url);

  if (
    /(svg|xml)/.test(response.headers.get("content-type") ?? "") ||
    url.endsWith(".svg")
  ) {
    const svgText = await response.text();
    return handleSvg({ type: "svg", value: svgText }, options);
  }

  const arrayBuffer = await response.arrayBuffer();
  const mimeType = getImageMimeType(arrayBuffer) || "png";

  const imageBitmap = await createImageBitmap(
    new Blob([arrayBuffer], { type: mimeType }),
  );

  if (!SUPPORTED_IMAGE_TYPES.includes(mimeType)) {
    /* v8 ignore next 3 */
    console.warn(`${mimeType} not supported by docx. Using fallback.`);
    return handleDataUrls(url, options);
  }

  return {
    type: mimeType,
    data: arrayBuffer,
    transformation: {
      width: imageBitmap.width,
      height: imageBitmap.height,
    },
  };
};

/**
 * The default image resolver.
 * Detects source type and invokes the correct handler (SVG, base64, remote).
 * Computes final dimensions while respecting maxW/maxH and DPI.
 */
const defaultImageResolver: ImageResolver = async (src, options, node) => {
  try {
    const imgOptions = await (node?.type === "svg"
      ? handleSvg(node, options)
      : src.startsWith("data:")
        ? handleDataUrls(src, options)
        : handleNonDataUrls(src, options));

    const { width: origW, height: origH } = imgOptions.transformation;
    let { width, height } = (node as Image)?.data ?? {};

    /* v8 ignore start */
    // Fill in missing dimensions using aspect ratio
    if (width && !height) {
      height = (origH * width) / origW;
    } else if (!width && height) {
      width = (origW * height) / origH;
    } else if (!width && !height) {
      width = origW;
      height = origH;
    }
    /* v8 ignore end */

    // Enforce maxW/maxH constraints using DPI
    const scale = Math.min(
      // skipcq: JS-0339
      (options.maxW * options.dpi) / width!,
      // skipcq: JS-0339
      (options.maxH * options.dpi) / height!,
      1,
    );

    // @ts-expect-error -- mutating transformation
    imgOptions.transformation = {
      width: width! * scale,
      height: height! * scale,
    };
    return imgOptions;
  } catch (error) {
    console.error(`Error resolving image: ${src}`, error);
    return getPlaceHolderImage(options);
  }
};

/**
 * Default fallback plugin configuration.
 * `imageResolver` is wrapped in a persistent cache to avoid redundant work.
 */
const defaultOptions: IDefaultImagePluginOptions = {
  scale: 3,
  fallbackImageType: "png",
  quality: 0.92,
  imageResolver: defaultImageResolver,
  maxW: 6.3,
  maxH: 9.7,
  dpi: 96,
  cacheConfig: {
    cacheMode: "both",
    ignoreKeys: ["dpi", "cacheConfig", "type", "alt"],
    parallel: true,
  },
  maxAgeMinutes: 7 * 24 * 60,
  fixGeneratedSvg,
};

/**
 * Image plugin for `@m2d/core`.
 * Resolves all inline images (base64, SVG, URL) for DOCX generation.
 */
export const imagePlugin: (options?: IImagePluginOptions) => IPlugin = (
  options_,
) => {
  const options = { ...defaultOptions, ...options_ };

  const cacheConfig = {
    cache: options.cache ?? undefined,
    ...defaultOptions.cacheConfig,
    ...options.cacheConfig,
    ignoreKeys: [
      ...(defaultOptions.cacheConfig?.ignoreKeys ?? []),
      ...(options.cacheConfig?.ignoreKeys ?? []),
    ],
  } as CacheConfigType<IImageOptions>;

  options.imageResolver = createPersistentCache(
    options.imageResolver,
    NAMESPACE,
    cacheConfig,
  );

  /** Preprocess step: resolves all image references in the MDAST. */
  const preprocess = async (root: Root, definitions: Definitions) => {
    const promises: Promise<void>[] = [];

    const preprocessInternal = (node: Root | RootContent | PhrasingContent) => {
      (node as Parent).children?.forEach(preprocessInternal);

      if (/^(image|svg)/.test(node.type)) {
        promises.push(
          (async () => {
            const src =
              (node as Image).url ??
              definitions[(node as ImageReference).identifier?.toUpperCase()];

            // *** 关键修复：如果 value 是 Promise（来自 mermaid plugin 的异步渲染），等待它完成 ***
            const svgValue = (node as SVG).value;
            if (svgValue && typeof svgValue === 'object' && typeof (svgValue as Promise<unknown>).then === 'function') {
              // 等待 Mermaid 渲染完成
              const renderResult = await svgValue as any;

              if (!renderResult || !renderResult.svg) {
                console.warn('[imagePlugin/preprocess] Mermaid rendering failed or returned invalid result, using placeholder');
                node.data = {
                  ...getPlaceHolderImage(options),
                  altText: { description: 'Mermaid rendering failed', name: 'Error', title: 'Error' },
                };
                return;
              }

              // 更新 node.value 为实际的 SVG 字符串，以便后续 imageResolver 处理
              (node as SVG).value = renderResult.svg;

              // 继续正常流程：src 保持 undefined（SVG 节点没有 url）
              // imageResolver 会通过 node 参数获取 SVG
            }

            const alt =
              (node as Image).alt ??
              (src?.startsWith("data:") ? "" : (src?.split("/")?.pop() ?? ""));

            const resolvedData = await options.imageResolver(
              src,
              options,
              node as Image | SVG,
            );

            node.data = {
              ...resolvedData,
              altText: { description: alt, name: alt, title: alt },
              ...(node as Image | SVG).data,
            };
          })(),
        );
      }
    };

    preprocessInternal(root);
    await Promise.all(promises);
  };

  let cleanupDone = false;
  return {
    preprocess,

    /** Renderer step: injects resolved image data into the final DOCX AST */
    inline: (docx, node, runProps) => {
      if (/^(image|svg)/.test(node.type)) {
        const imageData = (node as Image).data;

        // *** 防御性检查：如果 image data 不存在或不完整，跳过渲染 ***
        if (!imageData || !imageData.type || !imageData.transformation) {
          console.warn('[imagePlugin] ⚠️ Skipping inline rendering - invalid image data');
          return [];
        }

        (node as EmptyNode)._type = node.type;
        node.type = "";
        // @ts-expect-error -- extra props used for ImageRun
        return [new docx.ImageRun({ ...(node as Image).data, ...runProps })];
      }
      return [];
    },
    /** clean up IndexedDB once the document is packed */
    postprocess: () => {
      if (
        (options?.cacheConfig?.cacheMode
          ? options?.cacheConfig?.cacheMode !== "memory"
          : true) &&
        !cleanupDone
      ) {
        cleanupDone = true;
        simpleCleanup(options.maxAgeMinutes, NAMESPACE);
      }
    },
  };
};
