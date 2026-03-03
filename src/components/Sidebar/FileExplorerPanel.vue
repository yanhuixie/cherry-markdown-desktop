<script setup lang="ts">
import { computed } from 'vue';
import {
  sidebarState,
  refreshFileTree,
  closeFolder,
} from '../../stores/sidebarStore';
import FileTreeNode from './FileTreeNode.vue';

// 计算文件夹名称
const folderName = computed(() => {
  if (!sidebarState.openedFolderPath) {
    return '';
  }
  const parts = sidebarState.openedFolderPath.split(/[/\\]/);
  return parts[parts.length - 1] || sidebarState.openedFolderPath;
});

// 是否显示空状态
const showEmptyState = computed(() => {
  return !sidebarState.openedFolderPath;
});

// 是否显示"无文件"提示
const showNoFilesHint = computed(() => {
  return sidebarState.openedFolderPath &&
         !sidebarState.isLoadingTree &&
         sidebarState.fileTree.length === 0 &&
         !sidebarState.treeError;
});

// 处理刷新
function handleRefresh() {
  refreshFileTree();
}

// 处理关闭文件夹
function handleCloseFolder() {
  closeFolder();
}

// 发送打开文件夹事件
function emitOpenFolder() {
  window.dispatchEvent(new CustomEvent('sidebar-open-folder'));
}
</script>

<template>
  <div class="file-explorer-panel">
    <!-- 标题栏 -->
    <div class="panel-header">
      <template v-if="sidebarState.openedFolderPath">
        <span class="folder-name" :title="sidebarState.openedFolderPath">
          {{ folderName }}
        </span>
        <div class="header-actions">
          <button class="action-btn" @click="handleRefresh" title="刷新">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
          <button class="action-btn close-btn" @click="handleCloseFolder" title="关闭文件夹">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </template>
      <template v-else>
        <span class="panel-title">文件夹浏览器</span>
      </template>
    </div>

    <!-- 内容区域 -->
    <div class="panel-content">
      <!-- 未打开文件夹的空状态 -->
      <div v-if="showEmptyState" class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
        <p>打开文件夹以浏览文件</p>
        <button class="open-folder-btn" @click="emitOpenFolder">
          打开文件夹
        </button>
      </div>

      <!-- 加载中状态 -->
      <div v-else-if="sidebarState.isLoadingTree" class="loading-state">
        <div class="loading-spinner"></div>
        <p>正在加载...</p>
      </div>

      <!-- 错误状态 -->
      <div v-else-if="sidebarState.treeError" class="error-state">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p class="error-title">加载失败</p>
        <p class="error-message">{{ sidebarState.treeError }}</p>
        <button class="retry-btn" @click="handleRefresh">
          重试
        </button>
      </div>

      <!-- 无文件提示 -->
      <div v-else-if="showNoFilesHint" class="no-files-state">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
          <polyline points="13 2 13 9 20 9" />
        </svg>
        <p>此文件夹中没有 Markdown 文件</p>
      </div>

      <!-- 文件树 -->
      <div v-else class="file-tree">
        <FileTreeNode
          v-for="node in sidebarState.fileTree"
          :key="node.path"
          :node="node"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.file-explorer-panel {
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

.folder-name {
  font-size: 13px;
  font-weight: 500;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.header-actions {
  display: flex;
  gap: 4px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: #666;
  transition: all 0.15s;
}

.action-btn:hover {
  background-color: #e0e0e0;
  color: #333;
}

.close-btn:hover {
  background-color: #ff4d4f;
  color: #fff;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 24px;
  color: #999;
  text-align: center;
  height: 100%;
}

.empty-state svg {
  color: #ccc;
  margin-bottom: 12px;
}

.empty-state p {
  margin: 0;
  font-size: 13px;
}

.open-folder-btn {
  margin-top: 16px;
  padding: 8px 16px;
  background-color: #1890ff;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: background-color 0.2s;
}

.open-folder-btn:hover {
  background-color: #40a9ff;
}

/* 加载状态 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  color: #999;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid #e0e0e0;
  border-top-color: #1890ff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-state p {
  margin: 12px 0 0;
  font-size: 13px;
}

/* 错误状态 */
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 24px;
  color: #ff4d4f;
  text-align: center;
}

.error-state svg {
  margin-bottom: 8px;
}

.error-title {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
}

.error-message {
  margin: 8px 0 0;
  font-size: 12px;
  color: #999;
  word-break: break-all;
}

.retry-btn {
  margin-top: 12px;
  padding: 6px 12px;
  background-color: #ff4d4f;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: background-color 0.2s;
}

.retry-btn:hover {
  background-color: #ff7875;
}

/* 无文件状态 */
.no-files-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 24px;
  color: #999;
  text-align: center;
}

.no-files-state svg {
  color: #ccc;
  margin-bottom: 8px;
}

.no-files-state p {
  margin: 0;
  font-size: 13px;
}

/* 文件树 */
.file-tree {
  padding: 4px 0;
}

/* 暗色主题 */
html.dark .panel-header {
  border-bottom-color: #3e3e3e;
  background-color: #2d2d2d;
}

html.dark .panel-title {
  color: #999;
}

html.dark .folder-name {
  color: #d4d4d4;
}

html.dark .action-btn {
  color: #999;
}

html.dark .action-btn:hover {
  background-color: #3e3e3e;
  color: #d4d4d4;
}

html.dark .close-btn:hover {
  background-color: #ff4d4f;
  color: #fff;
}

html.dark .empty-state {
  color: #888;
}

html.dark .empty-state svg {
  color: #555;
}

html.dark .open-folder-btn {
  background-color: #1890ff;
}

html.dark .open-folder-btn:hover {
  background-color: #40a9ff;
}

html.dark .loading-spinner {
  border-color: #3e3e3e;
  border-top-color: #1890ff;
}

html.dark .loading-state {
  color: #888;
}

html.dark .error-state {
  color: #ff7875;
}

html.dark .error-message {
  color: #888;
}

html.dark .no-files-state {
  color: #888;
}

html.dark .no-files-state svg {
  color: #555;
}
</style>
