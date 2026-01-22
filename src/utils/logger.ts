import { invoke } from '@tauri-apps/api/core';

/**
 * 日志工具类，用于将前端日志输出到 Tauri 后端日志文件
 */
class Logger {
  /**
   * 记录信息级别日志
   * @param message 日志消息
   */
  async info(message: string): Promise<void> {
    console.log(`[Frontend] ${message}`);
    try {
      await invoke('log_frontend', { message });
    } catch (error) {
      console.error('[Logger] Failed to invoke log_frontend:', error);
    }
  }

  /**
   * 记录错误级别日志
   * @param message 日志消息
   */
  async error(message: string): Promise<void> {
    console.error(`[Frontend] ${message}`);
    try {
      await invoke('log_frontend', { message: `[ERROR] ${message}` });
    } catch (err) {
      console.error('[Logger] Failed to invoke log_frontend:', err);
    }
  }

  /**
   * 记录警告级别日志
   * @param message 日志消息
   */
  async warn(message: string): Promise<void> {
    console.warn(`[Frontend] ${message}`);
    try {
      await invoke('log_frontend', { message: `[WARN] ${message}` });
    } catch (error) {
      console.error('[Logger] Failed to invoke log_frontend:', error);
    }
  }
}

// 导出单例
export const logger = new Logger();

// 便捷函数
export const logInfo = (message: string) => logger.info(message);
export const logError = (message: string) => logger.error(message);
export const logWarn = (message: string) => logger.warn(message);
