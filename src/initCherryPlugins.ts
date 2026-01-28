/**
 * Cherry Markdown 插件初始化模块
 * 必须在任何 Cherry 实例创建之前执行
 *
 * 注意：此模块需要在 main.ts 中导入，确保插件在应用启动时就被注册
 */
import Cherry from 'cherry-markdown/dist/cherry-markdown.core.js';

let initPromise: Promise<boolean> | null = null;

/**
 * 初始化 mermaid 插件
 * 此函数确保在任何 Cherry 实例创建之前注册插件
 */
export async function initCherryPlugins(): Promise<boolean> {
  // 如果已经初始化过，直接返回结果
  if (initPromise) {
    return initPromise;
  }

  // 创建初始化 Promise
  initPromise = (async () => {
    try {
      console.log('[initCherryPlugins] Starting mermaid plugin initialization...');

      // 动态导入 mermaid 11.12.2
      const mermaidModule = await import('mermaid');
      const mermaid = (mermaidModule as any).default || mermaidModule;

      // 动态导入 Cherry Markdown 的 mermaid 插件
      const MermaidCodeEngineModule = await import('cherry-markdown/dist/addons/cherry-code-block-mermaid-plugin.js');
      const MermaidCodeEngine = (MermaidCodeEngineModule as any).default || MermaidCodeEngineModule;

      // 检查 Cherry 是否已经被实例化
      // @ts-ignore - Cherry 类有静态属性 initialized
      if (Cherry.initialized) {
        console.error('[initCherryPlugins] Cherry has already been instantiated! Cannot register plugin.');
        console.error('[initCherryPlugins] Make sure to call initCherryPlugins() before creating any Cherry instances.');
        return false;
      }

      // 注册 mermaid 插件到 Cherry（必须在任何 Cherry 实例创建之前）
      // 注意：mermaid v10+ 直接使用 mermaid 作为 API，不再有 mermaid.mermaidAPI
      Cherry.usePlugin(MermaidCodeEngine, {
        mermaid,
        mermaidAPI: mermaid, // v10+ 直接使用 mermaid
      });

      console.log('[initCherryPlugins] Mermaid plugin registered successfully');
      console.log('[initCherryPlugins] Mermaid loaded:', typeof mermaid);
      return true;
    } catch (error) {
      console.error('[initCherryPlugins] Failed to initialize mermaid plugin:', error);
      return false;
    }
  })();

  return initPromise;
}
