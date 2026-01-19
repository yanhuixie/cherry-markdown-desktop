<script setup lang="ts">
export type ExportFormat = 'html' | 'pdf' | 'png' | 'markdown' | 'docx';

export interface FormatOption {
  id: ExportFormat;
  name: string;
  extension: string;
  description: string;
  icon: string;
}

defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'select', format: ExportFormat): void;
  (e: 'close'): void;
}>();

const formatOptions: FormatOption[] = [
  {
    id: 'markdown',
    name: 'Markdown',
    extension: 'md',
    description: 'Markdown 源文件',
    icon: 'M'
  },
  {
    id: 'html',
    name: 'HTML',
    extension: 'html',
    description: '网页文件',
    icon: 'H'
  },
  {
    id: 'docx',
    name: 'Word 文档',
    extension: 'docx',
    description: 'Microsoft Word 文档',
    icon: 'W'
  },
  {
    id: 'pdf',
    name: '打印/PDF',
    extension: 'pdf',
    description: 'PDF 文档（需要在打印对话框中选择"另存为 PDF"）',
    icon: 'P'
  },
  {
    id: 'png',
    name: 'PNG 图片',
    extension: 'png',
    description: '截图图片',
    icon: 'I'
  },
];

function selectFormat(format: ExportFormat) {
  emit('select', format);
  emit('close');
}

function close() {
  emit('close');
}
</script>

<template>
  <Transition name="modal">
    <div v-if="visible" class="modal-overlay" @click="close">
      <div class="modal-container" @click.stop>
        <div class="modal-header">
          <h2 class="modal-title">选择导出/另存为格式</h2>
          <button class="modal-close" @click="close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="format-list">
            <button
              v-for="option in formatOptions"
              :key="option.id"
              class="format-option"
              @click="selectFormat(option.id)"
            >
              <div class="format-icon">{{ option.icon }}</div>
              <div class="format-info">
                <div class="format-name">{{ option.name }}</div>
                <div class="format-description">{{ option.description }}</div>
              </div>
              <div class="format-extension">.{{ option.extension }}</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.modal-container {
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  min-width: 400px;
  max-width: 500px;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  color: #6b7280;
  cursor: pointer;
  padding: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background-color 0.15s;
}

.modal-close:hover {
  background-color: #f3f4f6;
  color: #111827;
}

.modal-body {
  padding: 16px 20px;
}

.format-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.format-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background-color: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
}

.format-option:hover {
  background-color: #f9fafb;
  border-color: #d1d5db;
}

.format-option:active {
  background-color: #f3f4f6;
}

.format-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  font-weight: bold;
  font-size: 18px;
  border-radius: 6px;
  flex-shrink: 0;
}

.format-info {
  flex: 1;
}

.format-name {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 2px;
}

.format-description {
  font-size: 12px;
  color: #6b7280;
}

.format-extension {
  font-size: 12px;
  font-family: 'Courier New', monospace;
  color: #6b7280;
  background-color: #f3f4f6;
  padding: 4px 8px;
  border-radius: 4px;
}

/* 暗色主题 */
html.dark .modal-container {
  background-color: #2d2d2d;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

html.dark .modal-header {
  border-bottom-color: #3e3e3e;
}

html.dark .modal-title {
  color: #d4d4d4;
}

html.dark .modal-close {
  color: #888;
}

html.dark .modal-close:hover {
  background-color: #3e3e3e;
  color: #d4d4d4;
}

html.dark .format-option {
  background-color: #2d2d2d;
  border-color: #4a4a4a;
}

html.dark .format-option:hover {
  background-color: #3e3e3e;
  border-color: #5a5a5a;
}

html.dark .format-option:active {
  background-color: #4a4a4a;
}

html.dark .format-name {
  color: #d4d4d4;
}

html.dark .format-description {
  color: #888;
}

html.dark .format-extension {
  color: #888;
  background-color: #3e3e3e;
}

/* 过渡动画 */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s;
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: transform 0.2s, opacity 0.2s;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: scale(0.95);
  opacity: 0;
}
</style>
