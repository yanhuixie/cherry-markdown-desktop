import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  tabs,
  activeTabId,
  createTabItem,
  closeTab,
  setActiveTab,
  updateTabContent,
  markTabSaved,
  getActiveTab,
  isTabDirty,
  closeLeftTabs,
  closeRightTabs,
  closeAllTabs,
  TabItem,
} from './tabStore';
import { FileSyncStatus } from './fileSyncStatus';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

describe('tabStore', () => {
  beforeEach(() => {
    // 重置状态
    tabs.splice(0, tabs.length);
    activeTabId.value = null;
    localStorageMock.clear();
    // 抑制 console.log
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('createTabItem', () => {
    it('应创建普通文件的标签项', () => {
      const tab = createTabItem('tab-1', 'D:\\path\\file.md', 'content');
      expect(tab.id).toBe('tab-1');
      expect(tab.filePath).toBe('D:\\path\\file.md');
      expect(tab.fileName).toBe('file.md');
      expect(tab.content).toBe('content');
      expect(tab.syncStatus).toBe(FileSyncStatus.SYNCED);
    });

    it('应创建新文件的标签项 (isNewFile=true)', () => {
      const tab = createTabItem('tab-1', 'D:\\path\\new.md', 'content', true);
      expect(tab.syncStatus).toBe(FileSyncStatus.UNNAMED);
    });

    it('应创建 untitled 文件的标签项', () => {
      const tab = createTabItem('tab-1', 'untitled-1', 'content');
      expect(tab.syncStatus).toBe(FileSyncStatus.UNNAMED);
    });

    it('应创建远程 URL 的标签项（只读）', () => {
      const tab = createTabItem('tab-1', 'https://example.com/file.md', 'content');
      expect(tab.syncStatus).toBe(FileSyncStatus.READ_ONLY);
    });

    it('应正确提取 Unix 路径的文件名', () => {
      const tab = createTabItem('tab-1', '/path/to/file.md', 'content');
      expect(tab.fileName).toBe('file.md');
    });
  });

  describe('closeTab', () => {
    beforeEach(() => {
      tabs.push(
        { id: 'tab-1', filePath: 'file1.md', fileName: 'file1.md', content: '', syncStatus: FileSyncStatus.SYNCED },
        { id: 'tab-2', filePath: 'file2.md', fileName: 'file2.md', content: '', syncStatus: FileSyncStatus.SYNCED },
        { id: 'tab-3', filePath: 'file3.md', fileName: 'file3.md', content: '', syncStatus: FileSyncStatus.SYNCED }
      );
      activeTabId.value = 'tab-2';
    });

    it('应关闭指定的标签页', () => {
      closeTab('tab-2');
      expect(tabs.length).toBe(2);
      expect(tabs.find(t => t.id === 'tab-2')).toBeUndefined();
    });

    it('关闭当前标签页时应切换到同一索引位置的标签页', () => {
      // 原索引: tab-1(0), tab-2(1), tab-3(2)
      // 关闭 tab-2 后: tab-1(0), tab-3(1)
      // 索引 1 现在是 tab-3
      closeTab('tab-2');
      expect(activeTabId.value).toBe('tab-3');
    });

    it('关闭第一个标签页时应切换到下一个', () => {
      activeTabId.value = 'tab-1';
      closeTab('tab-1');
      expect(activeTabId.value).toBe('tab-2');
    });

    it('关闭最后一个标签页时应切换到前一个', () => {
      activeTabId.value = 'tab-3';
      closeTab('tab-3');
      expect(activeTabId.value).toBe('tab-2');
    });

    it('关闭唯一标签页时应将 activeTabId 设为 null', () => {
      tabs.splice(0, tabs.length);
      tabs.push({ id: 'tab-1', filePath: 'file1.md', fileName: 'file1.md', content: '', syncStatus: FileSyncStatus.SYNCED });
      activeTabId.value = 'tab-1';
      closeTab('tab-1');
      expect(activeTabId.value).toBeNull();
    });
  });

  describe('setActiveTab', () => {
    beforeEach(() => {
      tabs.push(
        { id: 'tab-1', filePath: 'file1.md', fileName: 'file1.md', content: '', syncStatus: FileSyncStatus.SYNCED },
        { id: 'tab-2', filePath: 'file2.md', fileName: 'file2.md', content: '', syncStatus: FileSyncStatus.SYNCED }
      );
    });

    it('应设置活动标签页', () => {
      setActiveTab('tab-2');
      expect(activeTabId.value).toBe('tab-2');
    });

    it('不应设置不存在的标签页为活动', () => {
      activeTabId.value = 'tab-1';
      setActiveTab('non-existent');
      expect(activeTabId.value).toBe('tab-1');
    });
  });

  describe('updateTabContent', () => {
    let tab: TabItem;

    beforeEach(() => {
      tab = createTabItem('tab-1', 'D:\\path\\file.md', 'original');
      tabs.push(tab);
    });

    it('应更新标签页内容', () => {
      updateTabContent('tab-1', 'new content');
      expect(tab.content).toBe('new content');
    });

    it('SYNCED 状态编辑后应变为 EDITED', () => {
      tab.syncStatus = FileSyncStatus.SYNCED;
      updateTabContent('tab-1', 'modified');
      expect(tab.syncStatus).toBe(FileSyncStatus.EDITED);
    });

    it('EXTERNALLY_MODIFIED 状态编辑后应变为 EDITED', () => {
      tab.syncStatus = FileSyncStatus.EXTERNALLY_MODIFIED;
      updateTabContent('tab-1', 'modified');
      expect(tab.syncStatus).toBe(FileSyncStatus.EDITED);
    });

    it('UNNAMED 状态编辑后应保持 UNNAMED', () => {
      tab.syncStatus = FileSyncStatus.UNNAMED;
      updateTabContent('tab-1', 'modified');
      expect(tab.syncStatus).toBe(FileSyncStatus.UNNAMED);
    });

    it('READ_ONLY 状态编辑后应保持 READ_ONLY', () => {
      tab.syncStatus = FileSyncStatus.READ_ONLY;
      updateTabContent('tab-1', 'modified');
      expect(tab.syncStatus).toBe(FileSyncStatus.READ_ONLY);
    });
  });

  describe('markTabSaved', () => {
    let tab: TabItem;

    beforeEach(() => {
      tab = createTabItem('tab-1', 'D:\\path\\file.md', 'content');
      tabs.push(tab);
    });

    it('EDITED 状态保存后应变为 SYNCED', () => {
      tab.syncStatus = FileSyncStatus.EDITED;
      markTabSaved('tab-1');
      expect(tab.syncStatus).toBe(FileSyncStatus.SYNCED);
    });

    it('CONFLICT 状态保存后应变为 SYNCED', () => {
      tab.syncStatus = FileSyncStatus.CONFLICT;
      markTabSaved('tab-1');
      expect(tab.syncStatus).toBe(FileSyncStatus.SYNCED);
    });

    it('UNNAMED 状态保存后应变为 SYNCED', () => {
      tab.syncStatus = FileSyncStatus.UNNAMED;
      markTabSaved('tab-1');
      expect(tab.syncStatus).toBe(FileSyncStatus.SYNCED);
    });

    it('应更新 lastSyncedModified 时间戳', () => {
      const before = Date.now();
      markTabSaved('tab-1');
      const after = Date.now();
      expect(tab.lastSyncedModified).toBeGreaterThanOrEqual(before);
      expect(tab.lastSyncedModified).toBeLessThanOrEqual(after);
    });
  });

  describe('getActiveTab', () => {
    it('应返回当前活动的标签页', () => {
      const tab = createTabItem('tab-1', 'file.md', 'content');
      tabs.push(tab);
      activeTabId.value = 'tab-1';
      const activeTab = getActiveTab();
      expect(activeTab).not.toBeNull();
      expect(activeTab?.id).toBe('tab-1');
    });

    it('没有活动标签页时应返回 null', () => {
      expect(getActiveTab()).toBeNull();
    });
  });

  describe('isTabDirty', () => {
    it('EDITED 状态应返回 true', () => {
      const tab: TabItem = { id: '1', filePath: 'f', fileName: 'f', content: '', syncStatus: FileSyncStatus.EDITED };
      expect(isTabDirty(tab)).toBe(true);
    });

    it('CONFLICT 状态应返回 true', () => {
      const tab: TabItem = { id: '1', filePath: 'f', fileName: 'f', content: '', syncStatus: FileSyncStatus.CONFLICT };
      expect(isTabDirty(tab)).toBe(true);
    });

    it('UNNAMED 状态应返回 true', () => {
      const tab: TabItem = { id: '1', filePath: 'f', fileName: 'f', content: '', syncStatus: FileSyncStatus.UNNAMED };
      expect(isTabDirty(tab)).toBe(true);
    });

    it('SYNCED 状态应返回 false', () => {
      const tab: TabItem = { id: '1', filePath: 'f', fileName: 'f', content: '', syncStatus: FileSyncStatus.SYNCED };
      expect(isTabDirty(tab)).toBe(false);
    });

    it('EXTERNALLY_MODIFIED 状态应返回 false', () => {
      const tab: TabItem = { id: '1', filePath: 'f', fileName: 'f', content: '', syncStatus: FileSyncStatus.EXTERNALLY_MODIFIED };
      expect(isTabDirty(tab)).toBe(false);
    });

    it('READ_ONLY 状态应返回 false', () => {
      const tab: TabItem = { id: '1', filePath: 'f', fileName: 'f', content: '', syncStatus: FileSyncStatus.READ_ONLY };
      expect(isTabDirty(tab)).toBe(false);
    });
  });

  describe('closeLeftTabs', () => {
    beforeEach(() => {
      tabs.push(
        { id: 'tab-1', filePath: 'file1.md', fileName: 'file1.md', content: '', syncStatus: FileSyncStatus.SYNCED },
        { id: 'tab-2', filePath: 'file2.md', fileName: 'file2.md', content: '', syncStatus: FileSyncStatus.SYNCED },
        { id: 'tab-3', filePath: 'file3.md', fileName: 'file3.md', content: '', syncStatus: FileSyncStatus.SYNCED },
        { id: 'tab-4', filePath: 'file4.md', fileName: 'file4.md', content: '', syncStatus: FileSyncStatus.SYNCED }
      );
    });

    it('应关闭指定标签页左侧的所有标签页', () => {
      closeLeftTabs('tab-3');
      expect(tabs.length).toBe(2);
      expect(tabs.map(t => t.id)).toEqual(['tab-3', 'tab-4']);
    });

    it('第一个标签页左侧没有标签页', () => {
      closeLeftTabs('tab-1');
      expect(tabs.length).toBe(4);
    });
  });

  describe('closeRightTabs', () => {
    beforeEach(() => {
      tabs.push(
        { id: 'tab-1', filePath: 'file1.md', fileName: 'file1.md', content: '', syncStatus: FileSyncStatus.SYNCED },
        { id: 'tab-2', filePath: 'file2.md', fileName: 'file2.md', content: '', syncStatus: FileSyncStatus.SYNCED },
        { id: 'tab-3', filePath: 'file3.md', fileName: 'file3.md', content: '', syncStatus: FileSyncStatus.SYNCED },
        { id: 'tab-4', filePath: 'file4.md', fileName: 'file4.md', content: '', syncStatus: FileSyncStatus.SYNCED }
      );
    });

    it('应关闭指定标签页右侧的所有标签页', () => {
      closeRightTabs('tab-2');
      expect(tabs.length).toBe(2);
      expect(tabs.map(t => t.id)).toEqual(['tab-1', 'tab-2']);
    });

    it('最后一个标签页右侧没有标签页', () => {
      closeRightTabs('tab-4');
      expect(tabs.length).toBe(4);
    });
  });

  describe('closeAllTabs', () => {
    beforeEach(() => {
      tabs.push(
        { id: 'tab-1', filePath: 'file1.md', fileName: 'file1.md', content: '', syncStatus: FileSyncStatus.SYNCED },
        { id: 'tab-2', filePath: 'file2.md', fileName: 'file2.md', content: '', syncStatus: FileSyncStatus.SYNCED }
      );
      activeTabId.value = 'tab-1';
    });

    it('应关闭所有标签页', () => {
      closeAllTabs();
      expect(tabs.length).toBe(0);
      expect(activeTabId.value).toBeNull();
    });
  });
});
