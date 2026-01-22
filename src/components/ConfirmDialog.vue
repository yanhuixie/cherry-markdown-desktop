<script setup lang="ts">
import { ref, watch } from 'vue';

export type ConfirmChoice = 'confirm' | 'cancel';

const props = defineProps<{
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}>();

const emit = defineEmits<{
  (e: 'choice', choice: ConfirmChoice): void;
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
    emit('choice', 'cancel');
  }
  ignoreNextWatchEmit = false;
});

function handleConfirm() {
  ignoreNextWatchEmit = true;
  isVisible.value = false;
  emit('choice', 'confirm');
}

function handleCancel() {
  ignoreNextWatchEmit = true;
  isVisible.value = false;
  emit('choice', 'cancel');
}
</script>

<template>
  <div v-show="isVisible" class="dialog-overlay" @click.self="handleCancel">
    <div class="dialog">
      <h3 class="dialog-title">{{ title }}</h3>
      <p class="dialog-message">{{ message }}</p>
      <div class="dialog-actions">
        <button class="dialog-btn dialog-btn-primary" @click="handleConfirm">
          {{ confirmText || '确定' }}
        </button>
        <button class="dialog-btn dialog-btn-secondary" @click="handleCancel">
          {{ cancelText || '取消' }}
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
  min-width: 400px;
  max-width: 500px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.dialog-title {
  margin: 0 0 16px 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.dialog-message {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #666;
  line-height: 1.5;
}

.dialog-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
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

.dialog-btn-primary {
  background-color: #007bff;
  color: #fff;
}

.dialog-btn-primary:hover {
  background-color: #0056b3;
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
  color: #e0e0e0;
}

html.dark .dialog-message {
  color: #a0a0a0;
}

html.dark .dialog-btn-primary {
  background-color: #0078d4;
}

html.dark .dialog-btn-primary:hover {
  background-color: #0060aa;
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
