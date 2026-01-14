<script setup lang="ts">
import { useTheme } from '../composables/useTheme';

defineEmits<{
  (e: 'new'): void;
  (e: 'open'): void;
  (e: 'save'): void;
  (e: 'save-as'): void;
  (e: 'toggle-mode'): void;
  (e: 'about'): void;
}>();

const { isDark, toggleTheme } = useTheme();
</script>

<template>
  <div class="toolbar">
    <button class="toolbar-btn" @click="$emit('open')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        <line x1="12" y1="11" x2="12" y2="17" />
        <line x1="9" y1="14" x2="15" y2="14" />
      </svg>
      打开
    </button>
    <button class="toolbar-btn" @click="$emit('new')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      新建
    </button>
    <button class="toolbar-btn" @click="$emit('save')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
        <polyline points="17 21 17 13 7 13 7 21" />
        <polyline points="7 3 7 8 15 8" />
      </svg>
      保存
    </button>
    <button class="toolbar-btn" @click="$emit('save-as')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="18" x2="12" y2="12" />
        <line x1="9" y1="15" x2="15" y2="15" />
      </svg>
      另存为
    </button>
    <button class="toolbar-btn" @click="$emit('toggle-mode')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      编辑/预览
    </button>
    <button class="toolbar-btn" @click="toggleTheme">
      <svg v-if="!isDark" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
      <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
      {{ isDark ? '暗色' : '亮色' }}
    </button>
    <button class="toolbar-btn" @click="$emit('about')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
      关于
    </button>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  padding: 8px;
  background-color: #f8f8f8;
  border-bottom: 1px solid #ddd;
  gap: 8px;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background-color: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  color: #333;
  transition: all 0.2s;
}

.toolbar-btn:hover {
  background-color: #f0f0f0;
  border-color: #ccc;
}

.toolbar-btn:active {
  background-color: #e0e0e0;
}

/* 暗色主题 */
html.dark .toolbar {
  background-color: #2d2d2d;
  border-bottom-color: #3e3e3e;
}

html.dark .toolbar-btn {
  background-color: #3c3c3c;
  border-color: #4a4a4a;
  color: #d4d4d4;
}

html.dark .toolbar-btn:hover {
  background-color: #4a4a4a;
  border-color: #5a5a5a;
}

html.dark .toolbar-btn:active {
  background-color: #5a5a5a;
}
</style>
