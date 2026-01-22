<script setup lang="ts">
import { ref, onUnmounted } from 'vue';
import type { TabItem } from '../stores/tabStore';
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

// 右键菜单状态
const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  tabIndex: -1,
});

const closeTabHandler = (e: MouseEvent, id: string) => {
  e.stopPropagation();
  emit('close', id);
};

// 右键点击处理
const handleRightClick = (e: MouseEvent, _tab: TabItem, tabIndex: number) => {
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
  <div class="tab-bar">
    <div
      v-for="(tab, index) in tabs"
      :key="tab.id"
      class="tab"
      :class="{ active: tab.id === activeTabId }"
      @click="emit('select', tab.id)"
      @contextmenu="handleRightClick($event, tab, index)"
    >
      <span class="tab-name">
        {{ tab.fileName }}
        <span v-if="tab.isDirty" class="dirty-mark">*</span>
      </span>
      <button class="close-btn" @click="closeTabHandler($event, tab.id)">×</button>
    </div>
  </div>

  <TabContextMenu
    :visible="contextMenu.visible"
    :x="contextMenu.x"
    :y="contextMenu.y"
    :tab-index="contextMenu.tabIndex"
    :total-tabs="tabs.length"
    @close="handleClose"
    @close-left="handleCloseLeft"
    @close-right="handleCloseRight"
    @close-all="handleCloseAll"
  />
</template>

<style scoped>
.tab-bar {
  display: flex;
  background-color: #f0f0f0;
  border-bottom: 1px solid #ddd;
  overflow-x: auto;
}

.tab {
  display: flex;
  align-items: center;
  padding: 8px 12px;
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

.tab-name {
  font-size: 13px;
  color: #333;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dirty-mark {
  color: #ff6b6b;
  margin-left: 2px;
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
  border-bottom-color: #3e3e3e;
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
