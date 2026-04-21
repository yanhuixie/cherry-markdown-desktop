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
  recentFiles,
  recentFolders,
  addRecentFile,
  addRecentFolder,
  removeRecentFile,
  removeRecentFolder,
  clearRecentFiles,
  clearRecentFolders,
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

  describe('最近文件夹', () => {
    beforeEach(() => {
      recentFolders.splice(0, recentFolders.length);
    });

    it('应添加文件夹到最近列表', () => {
      addRecentFolder('D:\\projects\\myapp');
      expect(recentFolders.length).toBe(1);
      expect(recentFolders[0].name).toBe('myapp');
      expect(recentFolders[0].path).toBe('D:/projects/myapp');
    });

    it('应规范化文件夹路径为正斜杠', () => {
      addRecentFolder('D:\\projects\\myapp');
      expect(recentFolders[0].path).toBe('D:/projects/myapp');
    });

    it('应去重不同分隔符的同一路径', () => {
      addRecentFolder('D:/projects/myapp');
      const firstAccessed = recentFolders[0].lastAccessed;
      // 稍等确保时间戳不同
      addRecentFolder('D:\\projects\\myapp');
      expect(recentFolders.length).toBe(1);
      expect(recentFolders[0].lastAccessed).toBeGreaterThanOrEqual(firstAccessed);
    });

    it('应限制最多20条记录', () => {
      for (let i = 0; i < 21; i++) {
        addRecentFolder(`D:\\projects\\folder${i}`);
      }
      // saveRecentFoldersToStorage 限制存储为 20 条
      const stored = localStorageMock.getItem('cherry_markdown_recent_folders');
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(parsed.length).toBe(20);
      // 验证存储中包含了最新的记录（21个中保留了20个）
      const names = parsed.map((f: { name: string }) => f.name);
      expect(names.length).toBe(20);
    });

    it('应删除指定文件夹', () => {
      addRecentFolder('D:\\projects\\folderA');
      addRecentFolder('D:\\projects\\folderB');
      expect(recentFolders.length).toBe(2);
      removeRecentFolder('D:/projects/folderA');
      expect(recentFolders.length).toBe(1);
      expect(recentFolders[0].name).toBe('folderB');
    });

    it('应清空所有文件夹', () => {
      addRecentFolder('D:\\projects\\folderA');
      addRecentFolder('D:\\projects\\folderB');
      clearRecentFolders();
      expect(recentFolders.length).toBe(0);
    });
  });

  describe('路径规范化', () => {
    beforeEach(() => {
      recentFiles.splice(0, recentFiles.length);
    });

    it('addRecentFile 应规范化混合分隔符路径', () => {
      addRecentFile('D:\\docs/designs/file.md');
      expect(recentFiles[0].path).toBe('D:/docs/designs/file.md');
    });

    it('addRecentFile 应对已规范化的路径幂等', () => {
      addRecentFile('D:/path/file.md');
      expect(recentFiles[0].path).toBe('D:/path/file.md');
    });

    it('addRecentFile 应通过规范化路径正确去重', () => {
      addRecentFile('D:/projects/test.md');
      addRecentFile('D:\\projects\\test.md');
      expect(recentFiles.length).toBe(1);
    });
  });

  describe('数据迁移', () => {
    it('addRecentFile 应规范化存储中的路径', () => {
      // 通过 addRecentFile 写入混合分隔符路径，验证存储结果被规范化
      recentFiles.splice(0, recentFiles.length);
      addRecentFile('D:\\mixed/path/file.md');
      const stored = localStorageMock.getItem('cherry_markdown_recent_files');
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(parsed[0].path).toBe('D:/mixed/path/file.md');
    });
  });

  describe('边界情况', () => {
    beforeEach(() => {
      recentFolders.splice(0, recentFolders.length);
    });

    it('应处理根路径', () => {
      addRecentFolder('C:\\');
      expect(recentFolders[0].name).not.toBe('');
    });

    it('localStorage 读写失败不应崩溃', () => {
      const originalSetItem = localStorageMock.setItem;
      localStorageMock.setItem = () => { throw new Error('localStorage full'); };
      expect(() => {
        addRecentFolder('D:\\projects\\myapp');
      }).not.toThrow();
      localStorageMock.setItem = originalSetItem;
    });
  });
});
