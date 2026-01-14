import { listen } from '@tauri-apps/api/event';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { onMounted, onUnmounted } from 'vue';

/**
 * 单实例文件打开监听器
 *
 * 监听来自 Rust 后端的 open-file-request 事件，
 * 当用户从外部（如资源管理器）打开 MD 文件时，
 * 在已运行的应用实例中打开新标签页。
 */
export function useFileOpener(onOpenFile: (filePath: string, content: string) => void) {
  let unlisten: (() => void) | null = null;

  const setupListener = async () => {
    try {
      unlisten = await listen<string>('open-file-request', async (event) => {
        const filePath = event.payload;
        console.log('[useFileOpener] Received open-file-request event:', filePath);

        try {
          // 读取文件内容
          const content = await readTextFile(filePath);
          console.log('[useFileOpener] File read successfully, content length:', content.length);

          // 调用回调函数处理文件打开
          onOpenFile(filePath, content);
        } catch (error) {
          console.error('[useFileOpener] Failed to open file:', error);
        }
      });

      console.log('[useFileOpener] Listener registered successfully');
    } catch (error) {
      console.error('[useFileOpener] Failed to register listener:', error);
    }
  };

  onMounted(() => {
    setupListener();
  });

  onUnmounted(() => {
    if (unlisten) {
      unlisten();
      console.log('[useFileOpener] Listener unregistered');
    }
  });
}
