<script setup lang="ts">
import type { TabItem } from '../stores/tabStore';

defineProps<{
  tabs: TabItem[];
  activeTabId: string | null;
}>();

const emit = defineEmits<{
  (e: 'close', id: string): void;
  (e: 'select', id: string): void;
}>();

const closeTabHandler = (e: MouseEvent, id: string) => {
  e.stopPropagation();
  emit('close', id);
};
</script>

<template>
  <div class="tab-bar">
    <div
      v-for="tab in tabs"
      :key="tab.id"
      class="tab"
      :class="{ active: tab.id === activeTabId }"
      @click="emit('select', tab.id)"
    >
      <span class="tab-name">
        {{ tab.fileName }}
        <span v-if="tab.isDirty" class="dirty-mark">*</span>
      </span>
      <button class="close-btn" @click="closeTabHandler($event, tab.id)">×</button>
    </div>
  </div>
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
