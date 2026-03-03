<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';
import {
  sidebarState,
  toggleSidebar,
  setSidebarWidth,
  getEffectiveWidth,
} from '../../stores/sidebarStore';
import SidebarTabs from './SidebarTabs.vue';
import OpenFilesPanel from './OpenFilesPanel.vue';
import FileExplorerPanel from './FileExplorerPanel.vue';

// 拖拽调整宽度相关
const isDragging = ref(false);
const sidebarRef = ref<HTMLElement | null>(null);

// 计算当前有效宽度
const effectiveWidth = computed(() => getEffectiveWidth());

// 开始拖拽
function startDrag(event: MouseEvent) {
  if (sidebarState.isCollapsed) {
    return;
  }
  isDragging.value = true;
  event.preventDefault();

  // 添加全局鼠标移动和释放事件
  document.addEventListener('mousemove', handleDrag);
  document.addEventListener('mouseup', stopDrag);
}

// 处理拖拽
function handleDrag(event: MouseEvent) {
  if (!isDragging.value) return;

  // 获取侧边栏相对于视口的位置
  if (sidebarRef.value) {
    const rect = sidebarRef.value.getBoundingClientRect();
    const newWidth = event.clientX - rect.left;
    setSidebarWidth(newWidth);
  }
}

// 停止拖拽
function stopDrag() {
  isDragging.value = false;
  document.removeEventListener('mousemove', handleDrag);
  document.removeEventListener('mouseup', stopDrag);
}

// 组件卸载时清理事件监听
onUnmounted(() => {
  document.removeEventListener('mousemove', handleDrag);
  document.removeEventListener('mouseup', stopDrag);
});
</script>

<template>
  <div
    ref="sidebarRef"
    class="sidebar"
    :class="{ 'collapsed': sidebarState.isCollapsed }"
    :style="{ width: `${effectiveWidth}px` }"
  >
    <!-- 侧边栏头部：折叠按钮 + 标签切换 -->
    <div class="sidebar-header">
      <button
        class="collapse-btn"
        @click="toggleSidebar"
        :title="sidebarState.isCollapsed ? '展开侧边栏' : '折叠侧边栏'"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          :class="{ 'rotated': sidebarState.isCollapsed }"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <!-- 标签切换（折叠时隐藏） -->
      <SidebarTabs v-if="!sidebarState.isCollapsed" />
    </div>

    <!-- 面板内容区域 -->
    <div class="sidebar-content" v-if="!sidebarState.isCollapsed">
      <OpenFilesPanel v-if="sidebarState.activeTab === 'openFiles'" />
      <FileExplorerPanel v-else-if="sidebarState.activeTab === 'fileExplorer'" />
    </div>

    <!-- 宽度调整手柄 -->
    <div
      v-if="!sidebarState.isCollapsed"
      class="resize-handle"
      :class="{ 'dragging': isDragging }"
      @mousedown="startDrag"
    />
  </div>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  background-color: #f8f8f8;
  border-right: 1px solid #ddd;
  position: relative;
  min-width: 48px;
  height: 100%;
  overflow: hidden;
  transition: none; /* 拖拽时禁用过渡效果 */
}

.sidebar.collapsed {
  min-width: 48px;
}

.sidebar-header {
  display: flex;
  align-items: center;
  padding: 0 8px;
  height: 46px;
  box-sizing: border-box;
  border-bottom: 1px solid #ddd;
  gap: 8px;
}

.collapse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px; /* 与 Toolbar 按钮的 padding 对齐 */
  background: transparent;
  border: 1px solid transparent; /* 与 Toolbar 按钮的 border 对齐 */
  border-radius: 4px;
  cursor: pointer;
  color: #666;
  transition: all 0.2s;
  flex-shrink: 0;
}

.collapse-btn:hover {
  background-color: #e0e0e0;
  color: #333;
}

.collapse-btn svg {
  transition: transform 0.2s;
}

.collapse-btn svg.rotated {
  transform: rotate(180deg);
}

.sidebar-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.resize-handle {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  cursor: col-resize;
  background: transparent;
  transition: background-color 0.2s;
  z-index: 10;
}

.resize-handle:hover,
.resize-handle.dragging {
  background-color: #1890ff;
}

/* 暗色主题 */
html.dark .sidebar {
  background-color: #2d2d2d;
  border-right-color: #3e3e3e;
}

html.dark .sidebar-header {
  border-bottom-color: #3e3e3e;
}

html.dark .collapse-btn {
  color: #999;
}

html.dark .collapse-btn:hover {
  background-color: #3e3e3e;
  color: #d4d4d4;
}

html.dark .resize-handle:hover,
html.dark .resize-handle.dragging {
  background-color: #1890ff;
}
</style>
