<script setup lang="ts">
import { computed } from 'vue';
import {
  tabs,
  activeTabId,
  setActiveTab,
  isTabDirty,
  type TabItem,
} from '../../stores/tabStore';
import { FileSyncStatus } from '../../stores/fileSyncStatus';

// 计算已打开的文件列表
const openedFiles = computed(() => tabs);

// 检查是否为当前活动文件
function isActive(tab: TabItem): boolean {
  return tab.id === activeTabId.value;
}

// 检查是否有未保存的修改
function hasUnsavedChanges(tab: TabItem): boolean {
  return isTabDirty(tab);
}

// 获取文件状态图标
function getStatusIcon(tab: TabItem): string {
  if (tab.syncStatus === FileSyncStatus.UNNAMED) {
    return 'unnamed';
  }
  if (tab.syncStatus === FileSyncStatus.EDITED) {
    return 'edited';
  }
  if (tab.syncStatus === FileSyncStatus.CONFLICT) {
    return 'conflict';
  }
  if (tab.syncStatus === FileSyncStatus.EXTERNALLY_MODIFIED) {
    return 'external';
  }
  if (tab.syncStatus === FileSyncStatus.READ_ONLY) {
    return 'readonly';
  }
  return '';
}

// 点击文件项
function handleFileClick(tab: TabItem) {
  setActiveTab(tab.id);
}
</script>

<template>
  <div class="open-files-panel">
    <!-- 标题栏 -->
    <div class="panel-header">
      <span class="panel-title">已打开的文件</span>
      <span class="file-count">{{ openedFiles.length }}</span>
    </div>

    <!-- 文件列表 -->
    <div class="file-list">
      <div v-if="openedFiles.length === 0" class="empty-state">
        <p>暂无打开的文件</p>
        <p class="hint">点击工具栏的"打开"按钮</p>
      </div>

      <div
        v-for="tab in openedFiles"
        :key="tab.id"
        class="file-item"
        :class="{ 'active': isActive(tab) }"
        @click="handleFileClick(tab)"
        :title="tab.filePath"
      >
        <!-- 文件图标 -->
        <svg class="file-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>

        <!-- 文件名 -->
        <span class="file-name">{{ tab.fileName }}</span>

        <!-- 状态指示器 -->
        <span
          v-if="hasUnsavedChanges(tab)"
          class="status-indicator modified"
          title="已修改"
        >●</span>
        <span
          v-else-if="getStatusIcon(tab) === 'readonly'"
          class="status-indicator readonly"
          title="只读"
        >🔒</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.open-files-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  height: 36px;
  box-sizing: border-box;
  border-bottom: 1px solid #e5e5e5;
  background-color: #f0f0f0;
}

.panel-title {
  font-size: 12px;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.file-count {
  font-size: 11px;
  color: #999;
  background-color: #e0e0e0;
  padding: 1px 6px;
  border-radius: 10px;
}

.file-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  color: #999;
  text-align: center;
}

.empty-state p {
  margin: 0;
  font-size: 13px;
}

.empty-state .hint {
  font-size: 12px;
  color: #bbb;
  margin-top: 4px;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  cursor: pointer;
  transition: background-color 0.15s;
  border-left: 3px solid transparent;
}

.file-item:hover {
  background-color: #f0f0f0;
}

.file-item.active {
  background-color: #e6f7ff;
  border-left-color: #1890ff;
}

.file-icon {
  flex-shrink: 0;
  color: #666;
}

.file-name {
  flex: 1;
  font-size: 13px;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-item.active .file-name {
  color: #1890ff;
  font-weight: 500;
}

.status-indicator {
  flex-shrink: 0;
  font-size: 10px;
}

.status-indicator.modified {
  color: #faad14;
}

.status-indicator.readonly {
  font-size: 12px;
}

/* 暗色主题 */
html.dark .panel-header {
  border-bottom-color: #3e3e3e;
  background-color: #2d2d2d;
}

html.dark .panel-title {
  color: #999;
}

html.dark .file-count {
  background-color: #3e3e3e;
  color: #888;
}

html.dark .empty-state {
  color: #888;
}

html.dark .empty-state .hint {
  color: #666;
}

html.dark .file-item:hover {
  background-color: #3e3e3e;
}

html.dark .file-item.active {
  background-color: #1e3a5f;
  border-left-color: #1890ff;
}

html.dark .file-icon {
  color: #999;
}

html.dark .file-name {
  color: #d4d4d4;
}

html.dark .file-item.active .file-name {
  color: #66b8ff;
}
</style>
