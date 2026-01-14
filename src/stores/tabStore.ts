import { reactive, ref } from 'vue';

export interface TabItem {
  id: string;
  filePath: string;
  fileName: string;
  content: string;
  isDirty: boolean;
  editorMode?: 'previewOnly' | 'edit&preview'; // 编辑器模式：预览模式 或 双栏编辑模式
}

export const tabs = reactive<TabItem[]>([]);
export const activeTabId = ref<string | null>(null);

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
