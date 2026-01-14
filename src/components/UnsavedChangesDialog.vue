<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';

export type UserChoice = 'save' | 'discard' | 'cancel';

const props = defineProps<{
  visible: boolean;
  fileName: string;
}>();

const emit = defineEmits<{
  (e: 'choice', choice: UserChoice): void;
}>();

const isVisible = ref(props.visible);
let ignoreNextWatchEmit = false;

onMounted(() => {
  console.log('[UnsavedChangesDialog] Component mounted, isVisible:', isVisible.value);
});

watch(
  () => props.visible,
  (newValue) => {
    console.log('[UnsavedChangesDialog] props.visible changed to:', newValue);
    isVisible.value = newValue;
    console.log('[UnsavedChangesDialog] isVisible set to:', isVisible.value);
  }
);

watch(isVisible, (newValue) => {
  console.log('[UnsavedChangesDialog] isVisible changed to:', newValue);
  if (!newValue && !ignoreNextWatchEmit) {
    console.log('[UnsavedChangesDialog] Emitting cancel');
    emit('choice', 'cancel');
  }
  ignoreNextWatchEmit = false;
});

function handleSave() {
  console.log('[UnsavedChangesDialog] handleSave called');
  ignoreNextWatchEmit = true;
  isVisible.value = false;
  emit('choice', 'save');
}

function handleDiscard() {
  console.log('[UnsavedChangesDialog] handleDiscard called');
  ignoreNextWatchEmit = true;
  isVisible.value = false;
  emit('choice', 'discard');
}

function handleCancel() {
  console.log('[UnsavedChangesDialog] handleCancel called');
  ignoreNextWatchEmit = true;
  isVisible.value = false;
  emit('choice', 'cancel');
}
</script>

<template>
  <div v-show="isVisible" class="dialog-overlay" @click.self="handleCancel">
    <div class="dialog">
      <h3 class="dialog-title">未保存的修改</h3>
      <p class="dialog-message">
        文件 <strong>{{ fileName }}</strong> 有未保存的修改。
      </p>
      <p class="dialog-message">您想如何处理？</p>
      <div class="dialog-actions">
        <button class="dialog-btn dialog-btn-primary" @click="handleSave">
          保存
        </button>
        <button class="dialog-btn dialog-btn-secondary" @click="handleDiscard">
          放弃修改
        </button>
        <button class="dialog-btn dialog-btn-secondary" @click="handleCancel">
          取消
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
