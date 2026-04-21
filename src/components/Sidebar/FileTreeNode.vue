<script setup lang="ts">
import { computed } from 'vue';
import { toggleTreeNode, type FileTreeNode as IFileTreeNode } from '../../stores/sidebarStore';
import { tabs, activeTabId, setActiveTab } from '../../stores/tabStore';
import { normalizePathSeparator, formatFileSize, formatModifiedTime } from '../../utils/pathUtils';

const props = defineProps<{
  node: IFileTreeNode;
  depth?: number;
}>();

// 默认深度为 0
const depth = computed(() => props.depth ?? 0);

// 缩进样式
const indentStyle = computed(() => ({
  paddingLeft: `${depth.value * 16 + 8}px`,
}));

// 检查文件是否已打开
const isOpened = computed(() => {
  return tabs.some(t => t.filePath === props.node.path);
});

// 检查是否为当前活动文件
const isActive = computed(() => {
  const activeTab = tabs.find(t => t.id === activeTabId.value);
  return activeTab?.filePath === props.node.path;
});

// 格式化 tooltip：路径 + 修改时间 + 文件大小
const tooltipText = computed(() => {
  const parts: string[] = [normalizePathSeparator(props.node.path)];
  const mtime = formatModifiedTime(props.node.modifiedTime);
  if (mtime) parts.push(mtime);
  if (!props.node.isDirectory && props.node.fileSize != null) {
    parts.push(formatFileSize(props.node.fileSize));
  }
  return parts.join('\n');
});

// 处理节点点击
async function handleClick() {
  if (props.node.isDirectory) {
    // 目录：切换展开状态
    await toggleTreeNode(props.node);
  } else {
    // 文件：打开或切换到该文件
    handleFileOpen();
  }
}

// 处理文件打开
function handleFileOpen() {
  // 检查是否已经打开
  const existingTab = tabs.find(t => t.filePath === props.node.path);
  if (existingTab) {
    // 切换到已打开的标签
    setActiveTab(existingTab.id);
  } else {
    // 发送事件让父组件处理文件打开
    window.dispatchEvent(new CustomEvent('sidebar-open-file', {
      detail: { filePath: props.node.path }
    }));
  }
}
</script>

<template>
  <div class="tree-node">
    <!-- 节点内容 -->
    <div
      class="node-content"
      :class="{
        'is-directory': node.isDirectory,
        'is-file': !node.isDirectory,
        'is-expanded': node.isExpanded,
        'is-active': isActive,
        'is-opened': isOpened && !node.isDirectory,
      }"
      :style="indentStyle"
      @click="handleClick"
      :title="tooltipText"
    >
      <!-- 展开/折叠箭头（目录） -->
      <span v-if="node.isDirectory" class="expand-arrow">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          :class="{ 'rotated': node.isExpanded }"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </span>
      <span v-else class="expand-placeholder"></span>

      <!-- 图标 -->
      <span class="node-icon">
        <!-- 目录图标 -->
        <svg v-if="node.isDirectory && !node.isExpanded" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
        <!-- 打开的目录图标 -->
        <svg v-else-if="node.isDirectory && node.isExpanded" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          <path d="M12 11v6" />
          <path d="M9 14h6" />
        </svg>
        <!-- 文件图标 -->
        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      </span>

      <!-- 名称 -->
      <span class="node-name">{{ node.name }}</span>

      <!-- 加载指示器 -->
      <span v-if="node.isLoading" class="loading-indicator">
        <svg class="spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      </span>

      <!-- 已打开指示器（文件） -->
      <span v-if="!node.isDirectory && isOpened" class="opened-indicator">●</span>
    </div>

    <!-- 子节点（递归） -->
    <div v-if="node.isDirectory && node.isExpanded && node.children.length > 0" class="node-children">
      <FileTreeNode
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :depth="depth + 1"
      />
    </div>
  </div>
</template>

<style scoped>
.tree-node {
  user-select: none;
}

.node-content {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  cursor: pointer;
  transition: background-color 0.15s;
  border-radius: 2px;
  margin: 0 4px;
}

.node-content:hover {
  background-color: #f0f0f0;
}

.node-content.is-active {
  background-color: #e6f7ff;
}

.node-content.is-opened:not(.is-active) {
  background-color: #f5f5f5;
}

.expand-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: #999;
}

.expand-arrow svg {
  transition: transform 0.2s;
}

.expand-arrow svg.rotated {
  transform: rotate(90deg);
}

.expand-placeholder {
  width: 16px;
  flex-shrink: 0;
}

.node-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #666;
}

.node-content.is-directory .node-icon {
  color: #faad14;
}

.node-name {
  flex: 1;
  font-size: 13px;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-content.is-active .node-name {
  color: #1890ff;
  font-weight: 500;
}

.loading-indicator {
  display: flex;
  align-items: center;
  color: #1890ff;
}

.spin {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.opened-indicator {
  font-size: 8px;
  color: #1890ff;
  flex-shrink: 0;
}

.node-children {
  /* 子节点容器 */
}

/* 暗色主题 */
html.dark .node-content:hover {
  background-color: #3e3e3e;
}

html.dark .node-content.is-active {
  background-color: #1e3a5f;
}

html.dark .node-content.is-opened:not(.is-active) {
  background-color: #353535;
}

html.dark .expand-arrow {
  color: #777;
}

html.dark .node-icon {
  color: #999;
}

html.dark .node-content.is-directory .node-icon {
  color: #faad14;
}

html.dark .node-name {
  color: #d4d4d4;
}

html.dark .node-content.is-active .node-name {
  color: #66b8ff;
}

html.dark .loading-indicator {
  color: #1890ff;
}

html.dark .opened-indicator {
  color: #1890ff;
}
</style>
