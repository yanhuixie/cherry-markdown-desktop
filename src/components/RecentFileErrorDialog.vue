<script setup lang="ts">
import { ref, watch } from 'vue';

export type RecentFileErrorChoice = 'remove' | 'close';

const props = defineProps<{
  visible: boolean;
  filePath: string;
}>();

const emit = defineEmits<{
  (e: 'choice', choice: RecentFileErrorChoice): void;
}>();

const isVisible = ref(props.visible);
let ignoreNextWatchEmit = false;

watch(
  () => props.visible,
  (newValue) => {
    isVisible.value = newValue;
  }
);

watch(isVisible, (newValue) => {
  if (!newValue && !ignoreNextWatchEmit) {
    emit('choice', 'close');
  }
  ignoreNextWatchEmit = false;
});

function handleRemove() {
  ignoreNextWatchEmit = true;
  isVisible.value = false;
  emit('choice', 'remove');
}

function handleClose() {
  ignoreNextWatchEmit = true;
  isVisible.value = false;
  emit('choice', 'close');
}
</script>

<template>
  <div v-show="isVisible" class="dialog-overlay" @click.self="handleClose">
    <div class="dialog">
      <div class="dialog-header">
        <span class="dialog-icon">❌</span>
        <h3 class="dialog-title">打开文件失败</h3>
      </div>
      <div class="dialog-content">
        <p class="error-message">无法打开文件，该文件可能已被删除或移动。</p>
        <p class="file-path">{{ filePath }}</p>
      </div>
      <div class="dialog-actions">
        <button class="dialog-btn dialog-btn-danger" @click="handleRemove">
          从最近记录中删除
        </button>
        <button class="dialog-btn dialog-btn-secondary" @click="handleClose">
          关闭
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.dialog {
  background-color: #fff;
  border-radius: 8px;
  padding: 24px;
  min-width: 450px;
  max-width: 550px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.dialog-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.dialog-icon {
  font-size: 24px;
  line-height: 1;
}

.dialog-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #d32f2f;
}

.dialog-content {
  margin-bottom: 24px;
}

.error-message {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #333;
  line-height: 1.5;
}

.file-path {
  margin: 0 0 8px 0;
  font-size: 13px;
  color: #666;
  font-family: 'Consolas', 'Monaco', monospace;
  word-break: break-all;
  background-color: #f5f5f5;
  padding: 8px 12px;
  border-radius: 4px;
}

.dialog-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.dialog-btn {
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.dialog-btn-danger {
  background-color: #d32f2f;
  color: #fff;
}

.dialog-btn-danger:hover {
  background-color: #b71c1c;
}

.dialog-btn-secondary {
  background-color: #fff;
  color: #333;
  border-color: #ddd;
}

.dialog-btn-secondary:hover {
  background-color: #f5f5f5;
  border-color: #ccc;
}

/* 暗色主题 */
html.dark .dialog {
  background-color: #2d2d2d;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
}

html.dark .dialog-title {
  color: #ef5350;
}

html.dark .error-message {
  color: #e0e0e0;
}

html.dark .file-path {
  background-color: #3c3c3c;
  color: #b0b0b0;
}

html.dark .dialog-btn-danger {
  background-color: #ef5350;
}

html.dark .dialog-btn-danger:hover {
  background-color: #e53935;
}

html.dark .dialog-btn-secondary {
  background-color: #3c3c3c;
  color: #d4d4d4;
  border-color: #4a4a4a;
}

html.dark .dialog-btn-secondary:hover {
  background-color: #4a4a4a;
  border-color: #5a5a5a;
}
</style>
