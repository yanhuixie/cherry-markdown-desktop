<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  visible: boolean;
  title?: string;
  message: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const isVisible = ref(props.visible);

watch(
  () => props.visible,
  (newValue) => {
    isVisible.value = newValue;
  }
);

watch(isVisible, (newValue) => {
  if (!newValue) {
    emit('close');
  }
});

function handleClose() {
  isVisible.value = false;
}
</script>

<template>
  <div v-show="isVisible" class="dialog-overlay" @click.self="handleClose">
    <div class="dialog">
      <div class="dialog-header">
        <span class="dialog-icon">⚠️</span>
        <h3 class="dialog-title">{{ title || '提示' }}</h3>
      </div>
      <div class="dialog-content">
        <p class="dialog-message">{{ message }}</p>
      </div>
      <div class="dialog-actions">
        <button class="dialog-btn dialog-btn-primary" @click="handleClose">
          确定
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
  color: #f57c00;
}

.dialog-content {
  margin-bottom: 24px;
}

.dialog-message {
  margin: 0;
  font-size: 14px;
  color: #333;
  line-height: 1.5;
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

.dialog-btn-primary {
  background-color: #007bff;
  color: #fff;
}

.dialog-btn-primary:hover {
  background-color: #0056b3;
}

/* 暗色主题 */
html.dark .dialog {
  background-color: #2d2d2d;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
}

html.dark .dialog-title {
  color: #ffb74d;
}

html.dark .dialog-message {
  color: #e0e0e0;
}

html.dark .dialog-btn-primary {
  background-color: #0078d4;
}

html.dark .dialog-btn-primary:hover {
  background-color: #0060aa;
}
</style>
