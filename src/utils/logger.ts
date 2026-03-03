import { invoke } from '@tauri-apps/api/core';

/**
 * 环境感知：是否为开发环境
 */
const isDev = import.meta.env.DEV;

/**
 * 日志工具类，用于将前端日志输出到 Tauri 后端日志文件
 * 同时根据环境控制控制台输出
 */
class Logger {
  /**
   * 记录调试级别日志（仅开发环境）
   * @param message 日志消息
   * @param args 附加参数
   */
  debug(message: string, ...args: unknown[]): void {
    if (isDev) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }

  /**
   * 记录信息级别日志
   * @param message 日志消息
   */
  async info(message: string): Promise<void> {
    if (isDev) {
      console.log(`[INFO] ${message}`);
    }
    try {
      await invoke('log_frontend', { message });
    } catch (error) {
      if (isDev) {
        console.error('[Logger] Failed to invoke log_frontend:', error);
      }
    }
  }

  /**
   * 记录错误级别日志
   * @param message 日志消息
   */
  async error(message: string): Promise<void> {
    console.error(`[ERROR] ${message}`);
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
    console.warn(`[WARN] ${message}`);
    try {
      await invoke('log_frontend', { message: `[WARN] ${message}` });
    } catch (error) {
      console.error('[Logger] Failed to invoke log_frontend:', error);
    }
  }

  /**
   * 创建带标签的日志器
   * @param tag 标签名称
   */
  withTag(tag: string) {
    return {
      debug: (message: string, ...args: unknown[]) => this.debug(`[${tag}] ${message}`, ...args),
      info: (message: string) => this.info(`[${tag}] ${message}`),
      warn: (message: string) => this.warn(`[${tag}] ${message}`),
      error: (message: string) => this.error(`[${tag}] ${message}`),
    };
  }
}

// 导出单例
export const logger = new Logger();

// 便捷函数
export const logDebug = (message: string, ...args: unknown[]) => logger.debug(message, ...args);
export const logInfo = (message: string) => logger.info(message);
export const logError = (message: string) => logger.error(message);
export const logWarn = (message: string) => logger.warn(message);
