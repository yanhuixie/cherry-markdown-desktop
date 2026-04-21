<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useTheme } from '../composables/useTheme';
import { useFontSize } from '../composables/useFontSize';
import { useFontFamily } from '../composables/useFontFamily';
import { useCodeBlock } from '../composables/useCodeBlock';
import { recentFiles, removeRecentFile, recentFolders, removeRecentFolder } from '../stores/tabStore';
import { openFolder, sidebarState } from '../stores/sidebarStore';
import RecentFileErrorDialog from './RecentFileErrorDialog.vue';
import type { RecentFileErrorChoice } from './RecentFileErrorDialog.vue';

const emit = defineEmits<{
  (e: 'new'): void;
  (e: 'open'): void;
  (e: 'open-folder'): void;
  (e: 'save'): void;
  (e: 'save-as'): void;
  (e: 'toggle-mode'): void;
  (e: 'about'): void;
}>();

defineProps<{
  isHtmlActive?: boolean;
}>();

const { isDark, toggleTheme } = useTheme();
const { currentFontSize, setFontSize, FONT_SIZE_CONFIGS } = useFontSize();
const { isMonospace, setFontFamily, initFontFamily } = useFontFamily();
const { allCodeExpanded, toggleCodeBlock } = useCodeBlock();

// 最近文件下拉菜单状态
const showRecentMenu = ref(false);
const recentMenuButton = ref<HTMLButtonElement | null>(null);
const recentMenuContainer = ref<HTMLDivElement | null>(null);
const activeRecentTab = ref<'files' | 'folders'>('files');

// 打开按钮下拉菜单状态
const showOpenMenu = ref(false);
const openMenuButton = ref<HTMLButtonElement | null>(null);

// 字体设置面板状态
const showFontPanel = ref(false);
const fontPanelButton = ref<HTMLButtonElement | null>(null);

// 切换最近文件菜单
function toggleRecentMenu() {
  showRecentMenu.value = !showRecentMenu.value;
  // 关闭其他菜单
  if (showRecentMenu.value) {
    activeRecentTab.value = 'files';
    showOpenMenu.value = false;
    showFontPanel.value = false;
  }
}

// 切换打开菜单
function toggleOpenMenu() {
  showOpenMenu.value = !showOpenMenu.value;
  // 关闭其他菜单
  if (showOpenMenu.value) {
    showRecentMenu.value = false;
    showFontPanel.value = false;
  }
}

// 切换字体设置面板
function toggleFontPanel() {
  showFontPanel.value = !showFontPanel.value;
  // 关闭其他菜单
  if (showFontPanel.value) {
    showRecentMenu.value = false;
    showOpenMenu.value = false;
  }
}

// 打开文件
function handleOpenFile() {
  showOpenMenu.value = false;
  emit('open');
}

// 打开文件夹
function handleOpenFolder() {
  showOpenMenu.value = false;
  emit('open-folder');
}

// 选择字号
function selectFontSize(level: 'medium' | 'large' | 'xlarge') {
  setFontSize(level);
  showFontPanel.value = false;
}

// 选择字体类型
function selectFontFamily(type: 'sansSerif' | 'monospace') {
  setFontFamily(type);
  showFontPanel.value = false;
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
    // 显示错误对话框
    showRecentFileError.value = true;
    errorFilePath.value = filePath;
    showRecentMenu.value = false;
  }
}

// 最近文件错误对话框状态
const showRecentFileError = ref(false);
const errorFilePath = ref('');

// 打开最近文件夹
async function openRecentFolder(folderPath: string) {
  try {
    await openFolder(folderPath);
    sidebarState.activeTab = 'fileExplorer';
    showRecentMenu.value = false;
  } catch (error) {
    console.error('[Toolbar] 打开最近文件夹失败:', error);
    removeRecentFolder(folderPath);
    showRecentMenu.value = false;
  }
}

// 处理错误对话框的用户选择
function handleRecentFileErrorChoice(choice: RecentFileErrorChoice) {
  if (choice === 'remove') {
    // 从最近记录中删除该文件
    removeRecentFile(errorFilePath.value);
  }
  showRecentFileError.value = false;
  errorFilePath.value = '';
}

// 点击外部关闭菜单
function handleClickOutside(event: MouseEvent) {
  if (recentMenuContainer.value && !recentMenuContainer.value.contains(event.target as Node)) {
    showRecentMenu.value = false;
  }
  if (openMenuButton.value && !openMenuButton.value.contains(event.target as Node)) {
    showOpenMenu.value = false;
  }
  if (fontPanelButton.value && !fontPanelButton.value.contains(event.target as Node)) {
    showFontPanel.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  initFontFamily();
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<template>
  <div class="toolbar" @contextmenu.prevent>
    <!-- 打开按钮（下拉菜单） -->
    <div class="open-menu-container">
      <button
        ref="openMenuButton"
        class="toolbar-btn"
        @click="toggleOpenMenu"
        :class="{ 'active': showOpenMenu }"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          <line x1="12" y1="11" x2="12" y2="17" />
          <line x1="9" y1="14" x2="15" y2="14" />
        </svg>
        打开
        <svg class="dropdown-arrow" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <!-- 打开下拉菜单 -->
      <div v-if="showOpenMenu" class="open-dropdown">
        <div class="open-item" @click="handleOpenFile">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <div class="item-content">
            <span class="item-label">打开文件</span>
            <span class="item-hint">打开 Markdown 文件</span>
          </div>
        </div>
        <div class="open-item" @click="handleOpenFolder">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <div class="item-content">
            <span class="item-label">打开文件夹</span>
            <span class="item-hint">浏览文件夹中的 Markdown 文件</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 最近文件按钮 -->
    <div class="recent-menu-container" ref="recentMenuContainer">
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
      <div v-if="showRecentMenu" class="recent-dropdown custom-scrollbar">
        <!-- Tab 栏 -->
        <div class="recent-tabs">
          <button 
            class="recent-tab" 
            :class="{ active: activeRecentTab === 'files' }"
            @click="activeRecentTab = 'files'"
          >文件</button>
          <button 
            class="recent-tab" 
            :class="{ active: activeRecentTab === 'folders' }"
            @click="activeRecentTab = 'folders'"
          >文件夹</button>
        </div>

        <!-- 文件列表 -->
        <div v-if="activeRecentTab === 'files'" class="recent-tab-content">
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

        <!-- 文件夹列表 -->
        <div v-if="activeRecentTab === 'folders'" class="recent-tab-content">
          <div v-if="recentFolders.length === 0" class="recent-empty">
            暂无最近文件夹
          </div>
          <ul v-else class="recent-list">
            <li 
              v-for="folder in recentFolders" 
              :key="folder.path"
              class="recent-item"
              @click="openRecentFolder(folder.path)"
              :title="folder.path"
            >
              <span class="recent-file-name">{{ folder.name }}</span>
              <span class="recent-file-path">{{ folder.path }}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- 最近文件错误对话框 -->
    <RecentFileErrorDialog
      :visible="showRecentFileError"
      :file-path="errorFilePath"
      @choice="handleRecentFileErrorChoice"
    />

    <button class="toolbar-btn" @click="$emit('new')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      新建
    </button>
    <button class="toolbar-btn" :disabled="isHtmlActive" :class="{ disabled: isHtmlActive }" @click="$emit('save')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
        <polyline points="17 21 17 13 7 13 7 21" />
        <polyline points="7 3 7 8 15 8" />
      </svg>
      保存
    </button>
    <button class="toolbar-btn" :disabled="isHtmlActive" :class="{ disabled: isHtmlActive }" @click="$emit('save-as')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="18" x2="12" y2="12" />
        <line x1="9" y1="15" x2="15" y2="15" />
      </svg>
      另存为
    </button>
    <button class="toolbar-btn" :disabled="isHtmlActive" :class="{ disabled: isHtmlActive }" @click="$emit('toggle-mode')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      编辑/预览
    </button>

    <!-- 代码块折叠/展开按钮 -->
    <button class="toolbar-btn" @click="toggleCodeBlock">
      <svg v-if="!allCodeExpanded" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="13 17 18 12 13 7" />
        <polyline points="6 17 11 12 6 7" />
      </svg>
      <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="11 17 6 12 11 7" />
        <polyline points="18 17 13 12 18 7" />
      </svg>
      {{ allCodeExpanded ? '折叠代码' : '展开代码' }}
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

    <!-- 字体设置按钮 -->
    <div class="font-panel-container">
      <button
        ref="fontPanelButton"
        class="toolbar-btn"
        @click="toggleFontPanel"
        :class="{ 'active': showFontPanel }"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 7V4h16v3" />
          <path d="M9 20h6" />
          <path d="M12 4v16" />
        </svg>
        字体
      </button>

      <!-- 字体设置面板 -->
      <div v-if="showFontPanel" class="font-panel">
        <!-- 字号选择区 -->
        <div class="font-section">
          <div class="section-title">字号</div>
          <div class="size-options">
            <button
              v-for="(config, key) in FONT_SIZE_CONFIGS"
              :key="key"
              class="option-btn"
              :class="{ 'selected': currentFontSize === key }"
              @click="selectFontSize(key as 'medium' | 'large' | 'xlarge')"
            >
              <span class="option-label">{{ config.label }}</span>
              <span class="option-preview" :style="{ fontSize: config.sizes.md }">A</span>
            </button>
          </div>
        </div>
        
        <div class="section-divider"></div>
        
        <!-- 字体类型切换区 -->
        <div class="font-section">
          <div class="section-title">字体</div>
          <div class="family-options">
            <button
              class="option-btn"
              :class="{ 'selected': !isMonospace }"
              @click="selectFontFamily('sansSerif')"
            >
              常规
            </button>
            <button
              class="option-btn"
              :class="{ 'selected': isMonospace }"
              @click="selectFontFamily('monospace')"
            >
              等宽
            </button>
          </div>
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
  line-height: 1; /* 固定行高，避免亚像素差异 */
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

.toolbar-btn.disabled {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
}

/* 下拉箭头 */
.dropdown-arrow {
  margin-left: 2px;
  opacity: 0.6;
}

/* 打开菜单容器 */
.open-menu-container {
  position: relative;
}

/* 打开下拉菜单 */
.open-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  min-width: 240px;
  background-color: #fff;
  border: 1px solid #ddd;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  overflow: hidden;
}

.open-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.open-item:hover {
  background-color: #f5f5f5;
}

.open-item svg {
  flex-shrink: 0;
  color: #666;
}

.open-item:hover svg {
  color: #1890ff;
}

.item-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item-label {
  font-size: 13px;
  color: #333;
  font-weight: 500;
}

.item-hint {
  font-size: 11px;
  color: #999;
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

/* 最近菜单 Tab 栏 */
.recent-tabs {
  display: flex;
  border-bottom: 1px solid #e8e8e8;
  padding: 0 4px;
}

.recent-tab {
  flex: 1;
  padding: 8px 16px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  font-size: 13px;
  color: #666;
  transition: color 0.15s, border-color 0.15s;
}

.recent-tab:hover {
  color: #333;
}

.recent-tab.active {
  color: #333;
  font-weight: 500;
  border-bottom-color: #4a90d9;
}

.recent-tab-content {
  max-height: 360px;
  overflow-y: auto;
}

/* 字体设置面板容器 */
.font-panel-container {
  position: relative;
}

/* 字体设置面板 */
.font-panel {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  min-width: 280px;
  background-color: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  overflow: hidden;
  padding: 12px;
}

.font-section {
  padding: 4px 0;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: #666;
  margin-bottom: 8px;
}

.section-divider {
  height: 1px;
  background-color: #e5e7eb;
  margin: 8px 0;
}

.size-options, .family-options {
  display: flex;
  gap: 8px;
}

.option-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 12px;
  min-width: 70px;
  background-color: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  flex: 1;
}

.option-btn:hover {
  background-color: #f9fafb;
  border-color: #d1d5db;
}

.option-btn.selected {
  background-color: #f0f7ff;
  border-color: #1890ff;
}

.option-label {
  font-size: 13px;
  color: #333;
  white-space: nowrap;
}

.option-preview {
  font-size: 14px;
  color: #666;
  font-weight: bold;
}

.option-btn.selected .option-label {
  color: #1890ff;
}

.option-btn.selected .option-preview {
  color: #1890ff;
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

html.dark .open-dropdown {
  background-color: #3c3c3c;
  border-color: #4a4a4a;
}

html.dark .open-item:hover {
  background-color: #4a4a4a;
}

html.dark .open-item svg {
  color: #999;
}

html.dark .open-item:hover svg {
  color: #66b8ff;
}

html.dark .item-label {
  color: #d4d4d4;
}

html.dark .item-hint {
  color: #888;
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

html.dark .recent-tabs {
  border-bottom-color: #3a3a3a;
}

html.dark .recent-tab {
  color: #999;
}

html.dark .recent-tab:hover {
  color: #ddd;
}

html.dark .recent-tab.active {
  color: #ddd;
  border-bottom-color: #5b9bd5;
}

html.dark .font-panel {
  background-color: #2d2d2d;
  border-color: #4a4a4a;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}

html.dark .section-title {
  color: #999;
}

html.dark .section-divider {
  background-color: #3e3e3e;
}

html.dark .option-btn {
  background-color: #2d2d2d;
  border-color: #4a4a4a;
  color: #d4d4d4;
}

html.dark .option-btn:hover {
  background-color: #3e3e3e;
  border-color: #5a5a5a;
}

html.dark .option-btn.selected {
  background-color: #1e3a5f;
  border-color: #1890ff;
}

html.dark .option-label {
  color: #d4d4d4;
}

html.dark .option-preview {
  color: #999;
}

html.dark .option-btn.selected .option-label {
  color: #66b8ff;
}

html.dark .option-btn.selected .option-preview {
  color: #66b8ff;
}
</style>
