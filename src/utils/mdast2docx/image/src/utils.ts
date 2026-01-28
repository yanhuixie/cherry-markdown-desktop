import type { IImageOptions } from "docx";
import type { IDefaultImagePluginOptions } from ".";

/**
 * Determines the MIME type of an image buffer using file signature detection.
 *
 * @param buffer - Binary image data as a Buffer or ArrayBuffer.
 * @returns Detected MIME type, or `undefined` if unknown.
 */
export const getImageMimeType = (
  buffer: Buffer | ArrayBuffer,
): "bmp" | "png" | "jpg" | "gif" | undefined => {
  const signatureArray = new Uint8Array(buffer).slice(0, 4);

  if (signatureArray[0] === 66 && signatureArray[1] === 77) return "bmp";

  const signature = signatureArray
    .reduce((acc, byte) => acc + byte.toString(16).padStart(2, "0"), "")
    .toUpperCase();

  switch (signature) {
    case "89504E47":
      return "png";
    case "47494638":
      return "gif";
    case "FFD8FFE0":
    case "FFD8FFE1":
    case "FFD8FFE2":
    case "FFD8FFE3":
    case "FFD8FFE8":
      return "jpg";
  }
};

let placeholderImg: IImageOptions | null = null;
let shouldEmitEmptyPlaceholder = false;

/**
 * Generates and returns a placeholder image.
 * If a placeholder source is defined, attempts to resolve it; otherwise returns an empty fallback.
 *
 * @param options - Image plugin configuration.
 * @returns Image options for the placeholder.
 */
export const getPlaceHolderImage = async (
  options: IDefaultImagePluginOptions,
) => {
  if (!placeholderImg && options.placeholder && !shouldEmitEmptyPlaceholder) {
    shouldEmitEmptyPlaceholder = true;
    // skipcq: JS-0357
    placeholderImg = await options.imageResolver(options.placeholder, options);
  } else {
    placeholderImg = {
      type: "gif",
      data: "",
      transformation: {
        width: 200,
        height: 200,
      },
    };
  }
  return placeholderImg;
};
