<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useTheme } from '../composables/useTheme';
import { useFontSize } from '../composables/useFontSize';
import { recentFiles } from '../stores/tabStore';

defineEmits<{
  (e: 'new'): void;
  (e: 'open'): void;
  (e: 'save'): void;
  (e: 'save-as'): void;
  (e: 'toggle-mode'): void;
  (e: 'about'): void;
}>();

const { isDark, toggleTheme } = useTheme();
const { currentFontSize, setFontSize, FONT_SIZE_CONFIGS } = useFontSize();

// 最近文件下拉菜单状态
const showRecentMenu = ref(false);
const recentMenuButton = ref<HTMLButtonElement | null>(null);

// 字号下拉菜单状态
const showFontSizeMenu = ref(false);
const fontSizeMenuButton = ref<HTMLButtonElement | null>(null);

// 切换最近文件菜单
function toggleRecentMenu() {
  showRecentMenu.value = !showRecentMenu.value;
}

// 切换字号菜单
function toggleFontSizeMenu() {
  showFontSizeMenu.value = !showFontSizeMenu.value;
}

// 选择字号
function selectFontSize(level: 'medium' | 'large' | 'xlarge') {
  setFontSize(level);
  showFontSizeMenu.value = false;
}

// 点击最近文件打开
async function openRecentFile(filePath: string) {
  try {
    const { readTextFile } = await import('@tauri-apps/plugin-fs');
    const content = await readTextFile(filePath);
    
    // 发送事件让父组件处理文件打开
    // 通过自定义事件传递文件路径和内容
    window.dispatchEvent(new CustomEvent('open-recent-file', {
      detail: { filePath, content }
    }));
    
    showRecentMenu.value = false;
  } catch (error) {
    console.error('[Toolbar] 打开最近文件失败:', error);
    showRecentMenu.value = false;
  }
}

// 点击外部关闭菜单
function handleClickOutside(event: MouseEvent) {
  if (recentMenuButton.value && !recentMenuButton.value.contains(event.target as Node)) {
    showRecentMenu.value = false;
  }
  if (fontSizeMenuButton.value && !fontSizeMenuButton.value.contains(event.target as Node)) {
    showFontSizeMenu.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
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
    
    <!-- 最近文件按钮 -->
    <div class="recent-menu-container">
      <button 
        ref="recentMenuButton"
        class="toolbar-btn" 
        @click="toggleRecentMenu"
        :class="{ 'active': showRecentMenu }"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        最近
      </button>
      
      <!-- 最近文件下拉菜单 -->
      <div v-if="showRecentMenu" class="recent-dropdown">
        <div v-if="recentFiles.length === 0" class="recent-empty">
          暂无最近文件
        </div>
        <ul v-else class="recent-list">
          <li 
            v-for="file in recentFiles" 
            :key="file.path"
            class="recent-item"
            @click="openRecentFile(file.path)"
            :title="file.path"
          >
            <span class="recent-file-name">{{ file.name }}</span>
            <span class="recent-file-path">{{ file.path }}</span>
          </li>
        </ul>
      </div>
    </div>
    
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

    <!-- 字号选择按钮 -->
    <div class="font-size-menu-container">
      <button
        ref="fontSizeMenuButton"
        class="toolbar-btn"
        @click="toggleFontSizeMenu"
        :class="{ 'active': showFontSizeMenu }"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 7V4h16v3" />
          <path d="M9 20h6" />
          <path d="M12 4v16" />
        </svg>
        字号
      </button>

      <!-- 字号下拉菜单 -->
      <div v-if="showFontSizeMenu" class="font-size-dropdown">
        <div class="font-size-title">选择字号</div>
        <div class="font-size-options">
          <button
            v-for="(config, key) in FONT_SIZE_CONFIGS"
            :key="key"
            class="font-size-option"
            :class="{ 'selected': currentFontSize === key }"
            @click="selectFontSize(key as 'medium' | 'large' | 'xlarge')"
          >
            <span class="font-size-label">{{ config.label }}</span>
            <span class="font-size-preview" :style="{ fontSize: config.sizes.md }">A</span>
          </button>
        </div>
      </div>
    </div>
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
  position: relative;
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

.toolbar-btn.active {
  background-color: #e0e0e0;
  border-color: #ccc;
}

/* 最近文件菜单容器 */
.recent-menu-container {
  position: relative;
}

/* 最近文件下拉菜单 */
.recent-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  min-width: 400px;
  max-width: 600px;
  max-height: 400px;
  overflow-y: auto;
  background-color: #fff;
  border: 1px solid #ddd;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
}

.recent-empty {
  padding: 20px;
  text-align: center;
  color: #999;
  font-size: 13px;
}

.recent-list {
  list-style: none;
  margin: 0;
  padding: 4px;
}

.recent-item {
  padding: 8px 12px;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  transition: background-color 0.15s;
}

.recent-item:hover {
  background-color: #f0f0f0;
}

.recent-file-name {
  font-size: 13px;
  color: #333;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-file-path {
  font-size: 11px;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 字号菜单容器 */
.font-size-menu-container {
  position: relative;
}

/* 字号下拉菜单 */
.font-size-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  min-width: 200px;
  background-color: #fff;
  border: 1px solid #ddd;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  overflow: hidden;
}

.font-size-title {
  padding: 10px 12px 8px;
  font-size: 12px;
  font-weight: 600;
  color: #666;
  border-bottom: 1px solid #eee;
}

.font-size-options {
  display: flex;
  flex-direction: column;
  padding: 4px;
}

.font-size-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: none;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.font-size-option:hover {
  background-color: #f0f0f0;
}

.font-size-option.selected {
  background-color: #e8f4fd;
  font-weight: 600;
}

.font-size-label {
  font-size: 13px;
  color: #333;
}

.font-size-preview {
  font-size: 16px;
  color: #666;
  font-weight: bold;
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

html.dark .toolbar-btn.active {
  background-color: #4a4a4a;
  border-color: #5a5a5a;
}

html.dark .recent-dropdown {
  background-color: #3c3c3c;
  border-color: #4a4a4a;
}

html.dark .recent-empty {
  color: #888;
}

html.dark .recent-item:hover {
  background-color: #4a4a4a;
}

html.dark .recent-file-name {
  color: #d4d4d4;
}

html.dark .recent-file-path {
  color: #888;
}

html.dark .font-size-dropdown {
  background-color: #3c3c3c;
  border-color: #4a4a4a;
}

html.dark .font-size-title {
  color: #999;
  border-bottom-color: #4a4a4a;
}

html.dark .font-size-option:hover {
  background-color: #4a4a4a;
}

html.dark .font-size-option.selected {
  background-color: #1e4d6b;
}

html.dark .font-size-label {
  color: #d4d4d4;
}

html.dark .font-size-preview {
  color: #999;
}
</style>
