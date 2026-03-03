import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { logger } from './logger';

/**
 * Tauri invoke 的包装器，自动捕获和记录命令执行错误
 *
 * 使用方法：将 `import { invoke } from '@tauri-apps/api/core'`
 * 替换为 `import { invoke } from '@/utils/tauriInvoke'`
 *
 * @param command Tauri 命令名称
 * @param args 命令参数
 * @returns Promise<T> 命令执行结果
 */
export async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await tauriInvoke<T>(command, args);
  } catch (error) {
    // 构建详细的错误信息
    const errorInfo = {
      command,
      args: args ? JSON.stringify(args) : undefined,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    };

    // 记录到日志文件
    const errorMessage = `[TAURI COMMAND ERROR] Command: ${command}${args ? `, Args: ${errorInfo.args}` : ''}, Error: ${errorInfo.error}`;

    // 异步记录日志（不阻塞错误传播）
    logger.error(errorMessage).catch((logError) => {
      console.error('[Failed to log Tauri command error]', logError);
    });

    // 同时输出到控制台
    console.error('[TAURI COMMAND ERROR]', errorInfo);

    // 重新抛出错误，让调用者可以处理
    throw error;
  }
}

/**
 * 可选：导出一个不抛出错误的版本，只记录日志
 * 适用于你不希望错误中断流程的场景
 */
export async function invokeSafe<T>(
  command: string,
  args?: Record<string, unknown>,
  defaultValue?: T
): Promise<T | undefined> {
  try {
    return await tauriInvoke<T>(command, args);
  } catch (error) {
    const errorInfo = {
      command,
      args: args ? JSON.stringify(args) : undefined,
      error: error instanceof Error ? error.message : String(error),
    };

    const errorMessage = `[TAURI COMMAND ERROR] Command: ${command}${args ? `, Args: ${errorInfo.args}` : ''}, Error: ${errorInfo.error}`;

    logger.error(errorMessage).catch((logError) => {
      console.error('[Failed to log Tauri command error]', logError);
    });

    console.warn('[TAURI COMMAND ERROR - SUPPRESSED]', errorInfo);

    return defaultValue;
  }
}
