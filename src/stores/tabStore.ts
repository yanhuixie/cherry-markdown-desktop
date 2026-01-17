import { reactive, ref } from 'vue';

export interface TabItem {
  id: string;
  filePath: string;
  fileName: string;
  content: string;
  isDirty: boolean;
  editorMode?: 'previewOnly' | 'edit&preview'; // 编辑器模式：预览模式 或 双栏编辑模式
}

export interface RecentFile {
  path: string;
  name: string;
  lastAccessed: number;
}

// 持久化存储键名
const STORAGE_KEY = 'cherry_markdown_recent_files';

// 从持久化存储加载数据
const loadRecentFilesFromStorage = (): RecentFile[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
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
    // 直接更新内容和标记为 dirty，不做内容比较
    console.log(`[tabStore] updateTabContent for tab ${id} (${tab.fileName}), was dirty: ${tab.isDirty}`);
    console.log(`[tabStore] Content (length ${content.length}): "${content}"`);

    tab.content = content;
    tab.isDirty = true;
    console.log(`[tabStore] tab ${id} (${tab.fileName}) updated, now dirty: ${tab.isDirty}`);
  }
}

export function markTabSaved(id: string): void {
  const tab = tabs.find(t => t.id === id);
  if (tab) {
    tab.isDirty = false;
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
