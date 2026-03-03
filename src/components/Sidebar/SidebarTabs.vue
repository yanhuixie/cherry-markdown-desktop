<script setup lang="ts">
import { setActiveSidebarTab, type SidebarTab } from '../../stores/sidebarStore';
import { sidebarState } from '../../stores/sidebarStore';

function handleTabClick(tab: SidebarTab) {
  setActiveSidebarTab(tab);
}
</script>

<template>
  <div class="sidebar-tabs">
    <button
      class="tab-btn"
      :class="{ 'active': sidebarState.activeTab === 'openFiles' }"
      @click="handleTabClick('openFiles')"
      title="已打开文件"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
      <span>文件</span>
    </button>
    <button
      class="tab-btn"
      :class="{ 'active': sidebarState.activeTab === 'fileExplorer' }"
      @click="handleTabClick('fileExplorer')"
      title="文件夹浏览器"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
      <span>文件夹</span>
    </button>
  </div>
</template>

<style scoped>
.sidebar-tabs {
  display: flex;
  flex: 1;
  gap: 4px;
  background-color: #e8e8e8;
  padding: 0; /* 移除容器 padding，让按钮高度直接决定高度 */
  border-radius: 4px;
}

.tab-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex: 1;
  padding: 6px 8px; /* 与 toolbar 按钮的 padding: 6px 12px 对齐 */
  background: transparent;
  border: 1px solid transparent; /* 添加透明边框，与 toolbar 按钮的 border: 1px 对齐 */
  border-radius: 3px;
  cursor: pointer;
  font-size: 13px; /* 与 toolbar 按钮的 font-size 对齐 */
  line-height: 1; /* 固定行高，避免亚像素差异 */
  color: #666;
  transition: all 0.2s;
}

.tab-btn:hover {
  background-color: #d8d8d8;
  color: #333;
}

.tab-btn.active {
  background-color: #fff;
  color: #333;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* 暗色主题 */
html.dark .sidebar-tabs {
  background-color: #252525;
}

html.dark .tab-btn {
  color: #999;
}

html.dark .tab-btn:hover {
  background-color: #3e3e3e;
  color: #d4d4d4;
}

html.dark .tab-btn.active {
  background-color: #3c3c3c;
  color: #d4d4d4;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}
</style>
