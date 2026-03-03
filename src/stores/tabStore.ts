import { reactive, ref } from 'vue';
import { FileSyncStatus, transitionOnEdit, transitionOnSave } from './fileSyncStatus';

export interface TabItem {
  id: string;
  filePath: string;
  fileName: string;
  content: string;

  // === 新的状态字段 ===
  /**
   * 文件同步状态
   * 替代原有的 isDirty 字段，提供更丰富的状态信息
   */
  syncStatus: FileSyncStatus;

  /**
   * 文件最后修改时间（磁盘时间戳，毫秒）
   * 用于检测文件是否真的被修改
   */
  fileLastModified?: number;

  /**
   * 内容最后已知同步的修改时间
   * 用于判断是否需要重新加载
   */
  lastSyncedModified?: number;

  /**
   * 文件大小（字节）
   * 用于快速检测文件是否变化
   */
  fileSize?: number;

  // === 其他现有字段 ===
  editorMode?: 'previewOnly' | 'edit&preview'; // 编辑器模式：预览模式 或 双栏编辑模式
}

export interface RecentFile {
  path: string;
  name: string;
  lastAccessed: number;
}

// 持久化存储键名
const STORAGE_KEY = 'cherry_markdown_recent_files';

/**
 * 类型守卫：检查对象是否为有效的 RecentFile
 */
function isValidRecentFile(item: unknown): item is RecentFile {
  return typeof item === 'object' &&
         item !== null &&
         typeof (item as RecentFile).path === 'string' &&
         typeof (item as RecentFile).name === 'string';
}

// 从持久化存储加载数据
const loadRecentFilesFromStorage = (): RecentFile[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // 类型校验：确保是数组且每个元素都符合 RecentFile 类型
      if (Array.isArray(parsed) && parsed.every(isValidRecentFile)) {
        return parsed;
      } else {
        console.warn('[tabStore] localStorage 数据格式无效，已忽略');
      }
    }
  } catch (error) {
    console.warn('[tabStore] 加载最近文件失败:', error);
  }
  return [];
};

// 保存数据到持久化存储
const saveRecentFilesToStorage = (files: RecentFile[]) => {
  try {
    // 只保留最近20个文件
    const filesToSave = files.slice(0, 20);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filesToSave));
  } catch (error) {
    console.warn('[tabStore] 保存最近文件失败:', error);
  }
};

export const tabs = reactive<TabItem[]>([]);
export const activeTabId = ref<string | null>(null);
export const recentFiles = reactive<RecentFile[]>(loadRecentFilesFromStorage());

/**
 * 添加文件到最近打开列表
 */
export function addRecentFile(filePath: string) {
  // 过滤掉 untitled 文件
  if (filePath.startsWith('untitled')) {
    return;
  }

  const fileName = filePath.split(/[/\\]/).pop() || filePath;
  const now = Date.now();

  // 检查是否已存在
  const existingIndex = recentFiles.findIndex(f => f.path === filePath);

  if (existingIndex >= 0) {
    // 更新访问时间
    recentFiles[existingIndex].lastAccessed = now;
  } else {
    // 添加新文件
    recentFiles.push({
      path: filePath,
      name: fileName,
      lastAccessed: now,
    });
  }

  // 按访问时间倒序排序
  recentFiles.sort((a, b) => b.lastAccessed - a.lastAccessed);

  // 保存到持久化存储
  saveRecentFilesToStorage(recentFiles);
}

/**
 * 清空最近文件列表
 */
export function clearRecentFiles() {
  recentFiles.splice(0, recentFiles.length);
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * 从最近文件列表中删除指定文件
 */
export function removeRecentFile(filePath: string) {
  const index = recentFiles.findIndex(f => f.path === filePath);
  if (index !== -1) {
    recentFiles.splice(index, 1);
    saveRecentFilesToStorage(recentFiles);
  }
}

/**
 * 创建新的标签项
 * 根据文件路径和内容自动确定初始状态
 */
export function createTabItem(
  id: string,
  filePath: string,
  content: string,
  isNewFile: boolean = false
): TabItem {
  const fileName = filePath.split(/[/\\]/).pop() || filePath;

  // 确定初始同步状态
  let syncStatus: FileSyncStatus;
  if (isNewFile || filePath.startsWith('untitled')) {
    syncStatus = FileSyncStatus.UNNAMED;
  } else if (/^https?:\/\//.test(filePath)) {
    syncStatus = FileSyncStatus.READ_ONLY;
  } else {
    syncStatus = FileSyncStatus.SYNCED;
  }

  return {
    id,
    filePath,
    fileName,
    content,
    syncStatus,
    fileLastModified: isNewFile ? undefined : Date.now(),
    lastSyncedModified: isNewFile ? undefined : Date.now(),
    fileSize: undefined,
  };
}

export function closeTab(id: string): void {
  const index = tabs.findIndex(t => t.id === id);
  if (index !== -1) {
    tabs.splice(index, 1);
    if (activeTabId.value === id) {
      if (tabs.length > 0) {
        activeTabId.value = tabs[Math.min(index, tabs.length - 1)].id;
      } else {
        activeTabId.value = null;
      }
    }
  }
}

export function setActiveTab(id: string): void {
  if (tabs.some(t => t.id === id)) {
    activeTabId.value = id;
  }
}

export function updateTabContent(id: string, content: string): void {
  const tab = tabs.find(t => t.id === id);
  if (tab) {
    // 直接更新内容和状态，不做内容比较
    console.log(`[tabStore] updateTabContent for tab ${id} (${tab.fileName}), was status: ${tab.syncStatus}`);
    console.log(`[tabStore] Content (length ${content.length}): "${content}"`);

    tab.content = content;
    // 使用状态转换函数更新状态
    tab.syncStatus = transitionOnEdit(tab.syncStatus);
    console.log(`[tabStore] tab ${id} (${tab.fileName}) updated, now status: ${tab.syncStatus}`);
  }
}

export function markTabSaved(id: string): void {
  const tab = tabs.find(t => t.id === id);
  if (tab) {
    // 使用状态转换函数更新状态
    tab.syncStatus = transitionOnSave(tab.syncStatus);
    tab.lastSyncedModified = Date.now();
  }
}

export function updateTabEditorMode(id: string, mode: 'previewOnly' | 'edit&preview'): void {
  const tab = tabs.find(t => t.id === id);
  if (tab) {
    tab.editorMode = mode;
  }
}

export function getActiveTab(): TabItem | null {
  return tabs.find(t => t.id === activeTabId.value) || null;
}

/**
 * 兼容性函数：判断标签页是否有未保存的修改
 * 用于向后兼容旧的 isDirty 字段
 */
export function isTabDirty(tab: TabItem): boolean {
  return tab.syncStatus === FileSyncStatus.EDITED ||
         tab.syncStatus === FileSyncStatus.CONFLICT ||
         tab.syncStatus === FileSyncStatus.UNNAMED;
}

/**
 * 关闭左侧所有标签页
 */
export function closeLeftTabs(id: string): void {
  const index = tabs.findIndex(t => t.id === id);
  if (index > 0) {
    const toRemove = tabs.slice(0, index).map(t => t.id);
    toRemove.forEach(tabId => closeTab(tabId));
  }
}

/**
 * 关闭右侧所有标签页
 */
export function closeRightTabs(id: string): void {
  const index = tabs.findIndex(t => t.id === id);
  if (index !== -1 && index < tabs.length - 1) {
    const toRemove = tabs.slice(index + 1).map(t => t.id);
    toRemove.forEach(tabId => closeTab(tabId));
  }
}

/**
 * 关闭所有标签页
 */
export function closeAllTabs(): void {
  tabs.splice(0, tabs.length);
  activeTabId.value = null;
}
