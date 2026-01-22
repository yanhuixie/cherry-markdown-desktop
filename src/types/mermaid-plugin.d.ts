/**
 * Cherry Markdown Core 版本类型声明
 * 使用 core 版本（不包含内置 mermaid）
 */
declare module 'cherry-markdown/dist/cherry-markdown.core.js' {
  import Cherry from 'cherry-markdown';
  export default Cherry;
}

/**
 * Cherry Markdown Mermaid 插件类型声明
 */
declare module 'cherry-markdown/dist/addons/cherry-code-block-mermaid-plugin.js' {
  import Cherry from 'cherry-markdown';

  export default class MermaidCodeEngine {
    static TYPE: string;
    static install(cherryOptions: any, ...args: any[]): void;
    constructor(options?: any);
    render(src: string, sign: string, engine: any, props?: any): string | Promise<string>;
  }
}

/**
 * Mermaid 类型声明（v11.x）
 */
declare module 'mermaid' {
  export interface MermaidConfig {
    startOnLoad?: boolean;
    theme?: 'default' | 'dark' | 'forest' | 'neutral' | 'base';
    logLevel?: number;
    securityLevel?: 'loose' | 'strict';
    fontFamily?: string;
  }

  export interface RenderResult {
    svg: string;
  }

  export interface MermaidStatic {
    initialize(config: MermaidConfig): void;
    render(id: string, text: string, config?: MermaidConfig): Promise<RenderResult>;
    run(config?: MermaidConfig): Promise<void>;
  }

  const mermaid: MermaidStatic;
  export default mermaid;
}
