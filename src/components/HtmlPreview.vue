<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { TabItem } from '../stores/tabStore';

const props = defineProps<{
  tab: TabItem;
}>();

const isLoading = ref(true);
const hasError = ref(false);
const errorMsg = ref('');

const iframeSrc = computed(() => {
  try {
    return convertFileSrc(props.tab.filePath);
  } catch (e) {
    console.error('[HtmlPreview] convertFileSrc failed:', e);
    hasError.value = true;
    errorMsg.value = String(e);
    return '';
  }
});

const iframeKey = computed(() => props.tab.fileLastModified ?? 0);

function handleLoad() {
  isLoading.value = false;
  hasError.value = false;
}

function handleError() {
  isLoading.value = false;
  hasError.value = true;
  errorMsg.value = '加载 HTML 文件失败';
}

onMounted(() => {
  if (!iframeSrc.value) {
    isLoading.value = false;
    hasError.value = true;
    errorMsg.value = '无法转换文件路径';
  }
});
</script>

<template>
  <div class="html-preview">
    <div v-if="isLoading" class="html-preview-loading">
      <div class="loading-spinner"></div>
      <span>正在加载 {{ tab.fileName }}...</span>
    </div>
    <div v-if="hasError" class="html-preview-error">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>加载失败</span>
      <span class="error-detail">{{ errorMsg }}</span>
    </div>
    <iframe
      v-if="iframeSrc"
      :src="iframeSrc"
      :key="iframeKey"
      class="html-preview-iframe"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      @load="handleLoad"
      @error="handleError"
    ></iframe>
  </div>
</template>

<style scoped>
.html-preview {
  width: 100%;
  height: 100%;
  position: relative;
  background-color: #fff;
}

.html-preview-iframe {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}

.html-preview-loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #666;
  font-size: 14px;
  background-color: #fff;
  z-index: 1;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e0e0e0;
  border-top-color: #1890ff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.html-preview-error {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #999;
  font-size: 14px;
  background-color: #fff;
  z-index: 1;
}

.html-preview-error svg {
  color: #ccc;
}

.error-detail {
  font-size: 12px;
  color: #bbb;
  max-width: 400px;
  text-align: center;
  word-break: break-all;
}

html.dark .html-preview {
  background-color: #1e1e1e;
}

html.dark .html-preview-loading {
  background-color: #1e1e1e;
  color: #999;
}

html.dark .html-preview-error {
  background-color: #1e1e1e;
  color: #777;
}

html.dark .html-preview-error svg {
  color: #555;
}
</style>
