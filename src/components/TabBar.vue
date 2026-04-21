<script setup lang="ts">
import { ref, onUnmounted } from 'vue';
import type { TabItem } from '../stores/tabStore';
import { getSyncStatusIcon, getSyncStatusText, isExternallyModified, isConflict } from '../stores/fileSyncStatus';
import TabContextMenu from './TabContextMenu.vue';

const props = defineProps<{
  tabs: TabItem[];
  activeTabId: string | null;
}>();

const emit = defineEmits<{
  (e: 'close', id: string): void;
  (e: 'select', id: string): void;
  (e: 'close-left', id: string): void;
  (e: 'close-right', id: string): void;
  (e: 'close-all'): void;
}>();

// 标签栏 DOM 引用
const tabBarRef = ref<HTMLElement | null>(null);

// 鼠标滚轮横向滚动
function handleWheel(event: WheelEvent) {
  if (tabBarRef.value) {
    const el = tabBarRef.value;
    if (el.scrollWidth > el.clientWidth) {
      event.preventDefault();
      el.scrollLeft += event.deltaY;
    }
  }
}

// 右键菜单状态
const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  tabIndex: -1,
  filePath: '',
});

const closeTabHandler = (e: MouseEvent, id: string) => {
  e.stopPropagation();
  emit('close', id);
};

// 获取状态图标
const getStatusIcon = (tab: TabItem): string => {
  return getSyncStatusIcon(tab.syncStatus);
};

// 获取状态文本（用于工具提示）
const getStatusText = (tab: TabItem): string => {
  return getSyncStatusText(tab.syncStatus);
};

// 判断是否为外部修改或冲突状态
const isExternallyModifiedTab = (tab: TabItem): boolean => {
  return isExternallyModified(tab.syncStatus);
};

// 判断是否为冲突状态
const isConflictTab = (tab: TabItem): boolean => {
  return isConflict(tab.syncStatus);
};

// 右键点击处理
const handleRightClick = (e: MouseEvent, tab: TabItem, tabIndex: number) => {
  e.preventDefault();
  e.stopPropagation();

  // 隐藏已显示的菜单
  if (contextMenu.value.visible) {
    hideContextMenu();
    return;
  }

  contextMenu.value = {
    visible: true,
    x: e.clientX,
    y: e.clientY,
    tabIndex,
    filePath: tab.filePath,
  };

  // 延迟添加全局点击监听，避免立即触发
  setTimeout(() => {
    document.addEventListener('click', handleGlobalClick);
  }, 0);
};

// 隐藏右键菜单
const hideContextMenu = () => {
  contextMenu.value.visible = false;
  document.removeEventListener('click', handleGlobalClick);
};

// 全局点击处理
const handleGlobalClick = (e: MouseEvent) => {
  const menuEl = document.querySelector('.tab-context-menu');
  if (menuEl && !menuEl.contains(e.target as Node)) {
    hideContextMenu();
  }
};

// 菜单项点击处理
const handleClose = () => {
  const tab = contextMenu.value.tabIndex >= 0 ? props.tabs[contextMenu.value.tabIndex] : null;
  if (tab) {
    emit('close', tab.id);
  }
  hideContextMenu();
};

const handleCloseLeft = () => {
  const tab = contextMenu.value.tabIndex >= 0 ? props.tabs[contextMenu.value.tabIndex] : null;
  if (tab) {
    emit('close-left', tab.id);
  }
  hideContextMenu();
};

const handleCloseRight = () => {
  const tab = contextMenu.value.tabIndex >= 0 ? props.tabs[contextMenu.value.tabIndex] : null;
  if (tab) {
    emit('close-right', tab.id);
  }
  hideContextMenu();
};

const handleCloseAll = () => {
  emit('close-all');
  hideContextMenu();
};

// 组件卸载时清理事件监听
onUnmounted(() => {
  document.removeEventListener('click', handleGlobalClick);
});
</script>

<template>
  <div ref="tabBarRef" class="tab-bar custom-scrollbar" @wheel="handleWheel">
    <div
      v-for="(tab, index) in tabs"
      :key="tab.id"
      class="tab"
      :class="{
        active: tab.id === activeTabId,
        'tab-externally-modified': isExternallyModifiedTab(tab),
        'tab-conflict': isConflictTab(tab)
      }"
      :title="`${tab.filePath} - ${getStatusText(tab)}`"
      @click="emit('select', tab.id)"
      @contextmenu="handleRightClick($event, tab, index)"
    >
      <span class="tab-status-icon" v-if="getStatusIcon(tab)">{{ getStatusIcon(tab) }}</span>
      <span class="tab-name">{{ tab.fileName }}</span>
      <button class="close-btn" @click="closeTabHandler($event, tab.id)">×</button>
    </div>
  </div>

  <TabContextMenu
    :visible="contextMenu.visible"
    :x="contextMenu.x"
    :y="contextMenu.y"
    :tab-index="contextMenu.tabIndex"
    :total-tabs="tabs.length"
    :file-path="contextMenu.filePath"
    @close="handleClose"
    @close-left="handleCloseLeft"
    @close-right="handleCloseRight"
    @close-all="handleCloseAll"
    @close-menu="hideContextMenu"
  />
</template>

<style scoped>
.tab-bar {
  display: flex;
  background-color: #f0f0f0;
  overflow-x: auto;
}

.tab {
  display: flex;
  align-items: center;
  padding: 0 12px;
  height: 36px;
  box-sizing: border-box;
  cursor: pointer;
  border-right: 1px solid #ddd;
  min-width: 100px;
  user-select: none;
}

.tab:hover {
  background-color: #e0e0e0;
}

.tab.active {
  background-color: #fff;
  border-bottom: 2px solid #396cd8;
}

.tab-status-icon {
  margin-right: 4px;
  font-size: 12px;
  flex-shrink: 0;
}

.tab-externally-modified {
  border-bottom: 2px solid #2196f3;
}

.tab-conflict {
  border-bottom: 2px solid #f44336;
  background-color: #fff5f5;
}

.tab-name {
  font-size: 13px;
  color: #333;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.close-btn {
  background: none;
  border: none;
  font-size: 16px;
  color: #999;
  cursor: pointer;
  padding: 0 4px;
  margin-left: 6px;
  line-height: 1;
}

.close-btn:hover {
  color: #ff4444;
}

/* 暗色主题 */
html.dark .tab-bar {
  background-color: #252526;
}

html.dark .tab {
  border-right-color: #3e3e3e;
}

html.dark .tab:hover {
  background-color: #2d2d2d;
}

html.dark .tab.active {
  background-color: #1e1e1e;
  border-bottom-color: #396cd8;
}

html.dark .tab-externally-modified {
  border-bottom-color: #2196f3;
}

html.dark .tab-conflict {
  background-color: #2d1b1b;
  border-bottom-color: #f44336;
}

html.dark .tab-name {
  color: #d4d4d4;
}

html.dark .close-btn {
  color: #858585;
}

html.dark .close-btn:hover {
  color: #ff6b6b;
}
</style>
