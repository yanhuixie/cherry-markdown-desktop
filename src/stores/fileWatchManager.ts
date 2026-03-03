/**
 * 文件监控管理器
 * 负责管理所有打开文件的监控，支持多文件同时监控
 */

import { watch, readTextFile } from '@tauri-apps/plugin-fs';
import type { UnwatchFn } from '@tauri-apps/plugin-fs';
import type { TabItem } from './tabStore';

/**
 * 文件监控条目
 */
interface FileWatchEntry {
  /** 文件路径 */
  filePath: string;
  /** 标签页 ID */
  tabId: string;
  /** 取消监控函数 */
  unwatch: UnwatchFn;
  /** 文件最后修改时间（磁盘） */
  lastModified: number;
}

/**
 * 文件监控配置
 */
interface WatchConfig {
  /** 防抖延迟（毫秒） */
  delayMs: number;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: WatchConfig = {
  delayMs: 500,
};

/**
 * 文件监控管理器类
 */
export class FileWatchManager {
  private watches: Map<string, FileWatchEntry> = new Map();
  private isSavingFile: boolean = false;
  private savedContentHash: Map<string, string> = new Map(); // 保存内容的哈希，用于比对
  private config: WatchConfig;

  constructor(config: Partial<WatchConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 计算内容哈希（简单实现，用于比对文件内容）
   * @param content 文件内容
   * @returns 哈希字符串
   */
  private computeHash(content: string): string {
    // 使用简单的哈希算法（djb2）
    let hash = 5381;
    for (let i = 0; i < content.length; i++) {
      hash = (hash * 33) ^ content.charCodeAt(i);
    }
    return (hash >>> 0).toString(16);
  }

  /**
   * 启动监控一个文件
   * @param tab 标签页对象
   * @param onFileChanged 文件变化回调函数
   * @returns 是否成功启动监控
   */
  async startWatch(
    tab: TabItem,
    onFileChanged: (filePath: string, tabId: string) => void
  ): Promise<boolean> {
    // 跳过远程文件和未命名文件
    if (!this.shouldWatch(tab)) {
      console.log(`[FileWatchManager] Skipping watch for: ${tab.filePath} (untitled or remote)`);
      return false;
    }

    const filePath = tab.filePath;

    // 如果已经在监控，先停止
    if (this.watches.has(filePath)) {
      const existing = this.watches.get(filePath);
      if (existing?.tabId === tab.id) {
        console.log(`[FileWatchManager] File already watched for same tab: ${filePath}`);
        return false;
      } else {
        // 不同标签页，停止旧的监控
        console.log(`[FileWatchManager] File already watched for different tab, stopping: ${filePath}`);
        this.stopWatch(filePath);
      }
    }

    try {
      // 获取当前时间戳作为初始修改时间
      const lastModified = Date.now();

      // 启动监控
      const unwatch = await watch(filePath, async () => {
        // 检查是否是应用自己保存的（通过哈希比对）
        if (this.isSavingFile) {
          try {
            // 读取当前文件内容并计算哈希
            const currentContent = await readTextFile(filePath);
            const currentHash = this.computeHash(currentContent);
            const savedHash = this.savedContentHash.get(filePath);

            if (savedHash === currentHash) {
              console.log(`[FileWatchManager] Ignoring self-save for: ${filePath} (hash match)`);
              return;
            }
          } catch (error) {
            // 如果读取失败，仍然使用标志位判断
            console.warn(`[FileWatchManager] Failed to read file for hash comparison: ${filePath}`, error);
          }
        }

        // 触发回调
        console.log(`[FileWatchManager] File changed: ${filePath}, tab: ${tab.id}`);
        onFileChanged(filePath, tab.id);
      }, {
        delayMs: this.config.delayMs,
      });

      // 保存监控条目
      this.watches.set(filePath, {
        filePath,
        tabId: tab.id,
        unwatch,
        lastModified,
      });

      console.log(`[FileWatchManager] Started watching: ${filePath} (tab: ${tab.id})`);
      return true;
    } catch (error) {
      console.error(`[FileWatchManager] Failed to watch ${filePath}:`, error);
      return false;
    }
  }

  /**
   * 停止监控一个文件
   * @param filePath 文件路径
   */
  stopWatch(filePath: string): void {
    const entry = this.watches.get(filePath);
    if (entry) {
      try {
        entry.unwatch();
        console.log(`[FileWatchManager] Stopped watching: ${filePath}`);
      } catch (error) {
        console.error(`[FileWatchManager] Error stopping watch for ${filePath}:`, error);
      }
      this.watches.delete(filePath);
    }
  }

  /**
   * 停止所有监控
   */
  stopAll(): void {
    console.log(`[FileWatchManager] Stopping all watches (${this.watches.size} files)`);
    for (const [filePath] of this.watches) {
      this.stopWatch(filePath);
    }
  }

  /**
   * 停止监控指定标签的所有文件
   * @param tabId 标签页 ID
   */
  stopWatchByTabId(tabId: string): void {
    const toStop: string[] = [];
    for (const [filePath, entry] of this.watches) {
      if (entry.tabId === tabId) {
        toStop.push(filePath);
      }
    }
    toStop.forEach(filePath => this.stopWatch(filePath));
    console.log(`[FileWatchManager] Stopped ${toStop.length} watches for tab: ${tabId}`);
  }

  /**
   * 更新监控的标签页 ID
   * 用于标签页 ID 变化的情况（一般不应该发生）
   * @param filePath 文件路径
   * @param newTabId 新的标签页 ID
   */
  updateTabId(filePath: string, newTabId: string): void {
    const entry = this.watches.get(filePath);
    if (entry) {
      entry.tabId = newTabId;
      console.log(`[FileWatchManager] Updated tab ID for ${filePath}: ${newTabId}`);
    }
  }

  /**
   * 获取当前监控的文件数量
   */
  getWatchCount(): number {
    return this.watches.size;
  }

  /**
   * 获取所有监控的文件路径
   */
  getWatchedFiles(): string[] {
    return Array.from(this.watches.keys());
  }

  /**
   * 检查文件是否正在被监控
   * @param filePath 文件路径
   */
  isWatching(filePath: string): boolean {
    return this.watches.has(filePath);
  }

  /**
   * 判断是否应该监控该文件
   * @param tab 标签页对象
   */
  private shouldWatch(tab: TabItem): boolean {
    // 不监控未命名文件
    if (!tab.filePath || tab.filePath.startsWith('untitled')) {
      return false;
    }

    // 不监控远程 URL 文件
    if (/^https?:\/\//.test(tab.filePath)) {
      return false;
    }

    return true;
  }

  /**
   * 标记正在保存（用于区分自身保存和外部修改）
   * @param isSaving 是否正在保存
   * @param filePath 文件路径（可选，用于哈希比对）
   * @param content 保存的内容（可选，用于哈希比对）
   */
  setSaving(isSaving: boolean, filePath?: string, content?: string): void {
    this.isSavingFile = isSaving;
    if (isSaving && filePath && content !== undefined) {
      // 保存时记录内容哈希
      this.savedContentHash.set(filePath, this.computeHash(content));
      console.log(`[FileWatchManager] Set saving flag: ${isSaving}, recorded hash for: ${filePath}`);
    } else if (!isSaving && filePath) {
      // 保存完成后清除哈希
      this.savedContentHash.delete(filePath);
      console.log(`[FileWatchManager] Set saving flag: ${isSaving}, cleared hash for: ${filePath}`);
    } else {
      console.log(`[FileWatchManager] Set saving flag: ${isSaving}`);
    }
  }

  /**
   * 清除指定文件的保存哈希
   * @param filePath 文件路径
   */
  clearSavedHash(filePath: string): void {
    this.savedContentHash.delete(filePath);
    console.log(`[FileWatchManager] Cleared saved hash for: ${filePath}`);
  }

  /**
   * 获取保存标志位状态
   */
  isSaving(): boolean {
    return this.isSavingFile;
  }
}

// 导出单例
export const fileWatchManager = new FileWatchManager();
