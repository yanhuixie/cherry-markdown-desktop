/**
 * Mermaid 插件 - 修复版本
 *
 * 基于 @m2d/mermaid 1.2.2，但移除了不合理的自动 trim 逻辑
 * 添加了详细的调试日志和更好的错误处理
 * 添加了 SVG 后处理（修复 <br>、NaN、markerUnits 问题）- 参考 cherry-markdown
 */

import { IPlugin, Parent, Root, SVG, PhrasingContent, RootContent } from "../../core/src";
import mermaid, { MermaidConfig, RenderResult } from "mermaid";

interface IMermaidPluginOptions {
  /**
   * Options for configuring Mermaid rendering.
   *
   * Pass a partial MermaidConfig object to customize behavior.
   * Refer to the Mermaid documentation for full configuration options:
   * @see https://mermaid.js.org/configuration.html
   */
  mermaidConfig?: MermaidConfig;

  /**
   * Optional fixer function to repair invalid Mermaid code before retrying render.
   */
  fixMermaid?: (mermaidCode: string, error: Error) => string;
}

/**
 * 所有支持的 Mermaid 图表类型
 *
 * 参考：cherry-markdown 的 CHART_TYPES 列表
 */
const CHART_TYPES = [
  'flowchart',
  'sequence',
  'gantt',
  'journey',
  'timeline',
  'class',
  'state',
  'er',
  'pie',
  'quadrantChart',
  'xyChart',
  'requirement',
  'architecture',
  'mindmap',
  'kanban',
  'gitGraph',
  'c4',
  'sankey',
  'packet',
  'block',
  'radar',
] as const;

/**
 * Default configuration for Mermaid rendering.
 *
 * 参考 cherry-markdown 的配置，添加了完整的图表类型配置
 *
 * @see https://mermaid.js.org/configuration.html#fontfamily
 */
const defaultMermaidConfig: MermaidConfig = {
  fontFamily: "sans-serif",
  startOnLoad: false,
  logLevel: 5,
};

// 为每种图表类型设置 useMaxWidth: false（参考 cherry-markdown）
CHART_TYPES.forEach((type) => {
  (defaultMermaidConfig as any)[type] = {
    useMaxWidth: false,
  };
});

/**
 * 修复 Mermaid 生成的 SVG 中的常见问题
 *
 * 参考 cherry-markdown 的 processSvgCode() 方法
 * https://github.com/Tencent/cherry-markdown/blob/master/src/addons/cherry-code-block-mermaid-plugin.js
 *
 * 修复内容：
 * 1. <br> → <br/>：Mermaid v11+ 生成的 SVG 可能包含非自闭合的 <br> 标签
 * 2. x="NaN"：某些图表计算错误时会产生 NaN 坐标值
 * 3. markerUnits="0"：某些 SVG 验证器不接受这个值
 *
 * @param svg - 原始 SVG 字符串
 * @returns 修复后的 SVG 字符串
 */
const fixSvgIssues = (svg: string): string => {
  return svg
    .replace(/<br>/g, '<br/>')           // 修复自闭合标签（最关键！）
    .replace(/\s*x="NaN"/g, '')           // 移除 NaN 坐标值
    .replace(/\s*markerUnits="0"/g, '');  // 移除无效的 markerUnits 属性
};

/**
 * Mermaid plugin for @m2d/core.
 * Detects `mermaid`, `mmd`, and `mindmap` code blocks and converts them to SVG.
 * The resulting SVGs are later rendered as images in DOCX exports.
 *
 * **修复内容**：
 * - 完全移除了不合理的自动 trim 逻辑
 * - 添加了详细的调试日志
 * - 改进了错误处理
 * - 添加了 SVG 后处理
 */
export const mermaidPlugin: (options?: IMermaidPluginOptions) => IPlugin = options => {
  // Merge user config with defaults and initialize Mermaid
  const finalConfig = { ...defaultMermaidConfig, ...options?.mermaidConfig };
  mermaid.initialize(finalConfig);

  const mermaidProcessor = async (value: string, _options: MermaidConfig): Promise<RenderResult | undefined> => {
    const mId = `m${crypto.randomUUID()}`; // Must not start with a number

    try {
      const result = await mermaid.render(mId, value);
      // *** 关键修复：应用 SVG 后处理（参考 cherry-markdown）***
      // 修复 SVG 字符串中的常见问题
      const fixedSvg = fixSvgIssues(result.svg);

      // 返回修复后的 RenderResult 对象
      return {
        ...result,
        svg: fixedSvg,
      };
    } catch (error) {
      console.error(`[md2docx] Mermaid render failed (ID: ${mId}):`, error);
      console.error(`[md2docx] Error name:`, (error as Error).name);
      console.error(`[md2docx] Error message:`, (error as Error).message);
      console.error(`[md2docx] Error stack:`, (error as Error).stack);

      // Optionally retry with fixed code
      if (options?.fixMermaid) {
        try {
          const fixedCode = options.fixMermaid(value, error as Error);
          const retryResult = await mermaid.render(mId, fixedCode);

          // 同样需要修复 SVG
          const fixedSvg = fixSvgIssues(retryResult.svg);
          return {
            ...retryResult,
            svg: fixedSvg,
          };
        } catch (error1) {
          console.error(`[md2docx] Mermaid render failed even after fix (ID: ${mId}):`, error1);
        }
      }

      // 返回 undefined 表示失败（符合类型定义）
      return undefined;
    }
  };

  const preprocess = (node: Root | RootContent | PhrasingContent) => {
    // Recursively walk the AST
    (node as Parent).children?.forEach(preprocess);

    // Replace supported code blocks with async SVG nodes
    if (node.type === "code" && /(mindmap|mermaid|mmd)/.test(node.lang ?? "")) {
      let value = node.value;

      // Add missing "mindmap" prefix if needed
      if (node.lang === "mindmap" && !value.startsWith("mindmap")) {
        value = `mindmap\n${value}`;
      }

      // *** 修复：完全移除了不合理的自动 trim 逻辑 ***
      // 原始代码（已删除）：
      // if (!/^mindmap|gantt|gitGraph|timeline|c4/i.test(value)) {
      //   value = value.split("\n").map(line => line.trim()).join("\n");
      // }
      //
      // 原因：这个 trim 逻辑会破坏某些 mermaid 图表的语法
      // Cherry-markdown 没有这个逻辑，所以 preview 模式正常，导出失败

      // console.log(`[md2docx] Final mermaid code (first 200 chars):`, value.substring(0, 200));

      // 简化：直接使用 Promise 包装，不使用复杂的缓存
      const svgNode: SVG = {
        type: "svg",
        value: mermaidProcessor(value, finalConfig),
        data: { mermaid: value }, // Preserve original source
      };

      Object.assign(node, {
        type: "paragraph",
        children: [svgNode],
        data: { alignment: "center" }, // Center-align diagram
      });
    }
  };

  return {
    /**
     * Transforms supported code blocks into centered SVGs for DOCX output.
     */
    preprocess,

    /** clean up - no-op since we're not using persistent cache */
    postprocess: () => {
      // No-op
    },
  };
};
