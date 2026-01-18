<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { readTextFile, writeTextFile, watch as watchFile } from '@tauri-apps/plugin-fs';
import { open, save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { tabs, activeTabId, closeTab, setActiveTab, updateTabContent, markTabSaved, addRecentFile } from './stores/tabStore';
import TabBar from './components/TabBar.vue';
import Toolbar from './components/Toolbar.vue';
import CherryEditor from './components/CherryEditor.vue';
import AboutDialog from './components/AboutDialog.vue';
import FileReloadDialog from './components/FileReloadDialog.vue';
import UnsavedChangesDialog, { type UserChoice } from './components/UnsavedChangesDialog.vue';
import { useFileOpener } from './composables/useFileOpener';

// 文件监视相关常量
const FILE_WATCH_DEBOUNCE_MS = 500; // 文件监视的防抖延迟（毫秒）
const SAVE_FLAG_CLEAR_DELAY_MS = FILE_WATCH_DEBOUNCE_MS + 100; // 保存标志位清除延迟（比防抖延迟多 100ms 确保安全）

// 文件重新加载对话框状态
const showFileReloadDialog = ref(false);
const pendingReloadFileName = ref('');
const pendingReloadFilePath = ref('');
const pendingReloadHasUnsavedChanges = ref(false);
let unwatchFn: (() => void) | null = null;
let isSavingFile = false; // 标志位：标识当前是否正在保存文件（用于区分自身保存和外部修改）

// 未保存变更对话框状态
const showUnsavedChangesDialog = ref(false);
const pendingCloseTabId = ref<string | null>(null);
const pendingCloseFileName = ref('');
let pendingWindowCloseResolve: ((choice: UserChoice) => void) | null = null;
let shouldAllowWindowClose = false; // 标志位：是否允许窗口关闭

// 监控对话框状态变化（调试用）
watch(showUnsavedChangesDialog, (newValue) => {
  console.log('[App] showUnsavedChangesDialog changed to:', newValue);
});

const activeTab = computed(() => tabs.find(t => t.id === activeTabId.value) || null);

// 关于对话框状态
const showAbout = ref(false);

// Cherry Editor 组件引用
const cherryEditorRef = ref<InstanceType<typeof CherryEditor> | null>(null);

// 设置单实例文件打开监听器
useFileOpener((filePath: string, content: string) => {
  console.log('[App] Opening file from single instance:', filePath);

  const fileName = filePath.split(/[/\\]/).pop() || filePath;

  // 检查是否已经打开该文件
  const existingTab = tabs.find(t => t.filePath === filePath);
  if (existingTab) {
    console.log('[App] File already open, switching to tab');
    setActiveTab(existingTab.id);
    return;
  }

  // 创建新标签
  const id = `tab-${Date.now()}`;
  tabs.push({
    id,
    filePath,
    fileName,
    content,
    isDirty: false,
  });
  activeTabId.value = id;
  console.log('[App] File opened successfully from single instance');
});

// 应用挂载后检查是否有待打开的文件
onMounted(async () => {
  console.log('[App] Mounted, checking for pending file...');
  try {
    const filePath = await invoke<string | null>('get_pending_file');
    console.log('[App] Pending file:', filePath);
    if (filePath) {
      await openFileFromPath(filePath);
    }
  } catch (error) {
    console.error('[App] Failed to get pending file:', error);
  }

  // 监听窗口关闭事件，检查所有标签页是否有未保存的修改
  try {
    console.log('[App] Registering close requested listener...');
    const unlisten = await getCurrentWindow().onCloseRequested((event) => {
      console.log('[App] Close requested event triggered, shouldAllowWindowClose:', shouldAllowWindowClose);

      // 如果标志位为 true，允许窗口关闭
      if (shouldAllowWindowClose) {
        console.log('[App] Allowing window close');
        return; // 不阻止关闭
      }

      // 查找所有有未保存修改的标签页
      const dirtyTabs = tabs.filter(t => t.isDirty);
      console.log('[App] Dirty tabs count:', dirtyTabs.length);

      if (dirtyTabs.length > 0) {
        // 阻止窗口关闭
        console.log('[App] Preventing window close, showing dialogs');
        event.preventDefault();

        // 异步处理未保存的标签页
        (async () => {
          // 处理每个未保存的标签页
          for (const tab of dirtyTabs) {
            console.log('[App] Processing dirty tab:', tab.fileName);
            pendingCloseTabId.value = tab.id;
            pendingCloseFileName.value = tab.fileName;

            // 先隐藏对话框（如果之前显示过）
            showUnsavedChangesDialog.value = false;
            await nextTick();

            // 然后显示对话框
            showUnsavedChangesDialog.value = true;
            await nextTick();

            console.log('[App] Dialog should be visible now');

            // 等待用户选择
            const choice = await new Promise<UserChoice>((resolve) => {
              pendingWindowCloseResolve = resolve;
            });

            console.log('[App] User choice:', choice);

            // 根据用户选择处理
            if (choice === 'cancel') {
              // 用户取消，停止关闭流程
              console.log('[App] User cancelled, stopping close');
              pendingCloseTabId.value = null;
              pendingCloseFileName.value = '';
              showUnsavedChangesDialog.value = false;
              return;
            } else if (choice === 'discard') {
              // 放弃修改，继续下一个标签页
              console.log('[App] User discarded changes');
              pendingCloseTabId.value = null;
              pendingCloseFileName.value = '';
              showUnsavedChangesDialog.value = false;
              continue;
            } else if (choice === 'save') {
              // 保存文件
              console.log('[App] User chose to save');
              isSavingFile = true; // 标记正在保存
              try {
                if (tab.filePath && !tab.filePath.startsWith('untitled')) {
                  await writeTextFile(tab.filePath, tab.content);
                  markTabSaved(tab.id);
                } else {
                  // 未命名文件，需要另存为
                  const filePath = await save({
                    filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
                  });
                  if (!filePath) {
                    // 用户取消了另存为，停止关闭流程
                    console.log('[App] User cancelled save as, stopping close');
                    isSavingFile = false;
                    pendingCloseTabId.value = null;
                    pendingCloseFileName.value = '';
                    showUnsavedChangesDialog.value = false;
                    return;
                  }
                  await writeTextFile(filePath, tab.content);
                  tab.filePath = filePath;
                  tab.fileName = filePath.split(/[/\\]/).pop() || filePath;
                  markTabSaved(tab.id);
                }
                // 延迟清除标志位
                setTimeout(() => {
                  isSavingFile = false;
                }, SAVE_FLAG_CLEAR_DELAY_MS);
              } catch (error) {
                isSavingFile = false;
                throw error;
              }
              pendingCloseTabId.value = null;
              pendingCloseFileName.value = '';
              showUnsavedChangesDialog.value = false;
            }
          }

          // 所有未保存的文件都已处理，设置标志位并关闭窗口
          console.log('[App] All dirty tabs processed, closing window');
          shouldAllowWindowClose = true;
          await getCurrentWindow().close();
        })();
      }
    });

    // 保存 unlisten 函数以便在组件卸载时清理（如果需要）
    (window as any).__closeRequestedUnlisten = unlisten;
    console.log('[App] Close requested listener registered successfully');
  } catch (error) {
    console.error('[App] Failed to register close requested listener:', error);
  }

  // 添加键盘事件监听
  window.addEventListener('keydown', handleKeyDown);
  
  // 添加最近文件事件监听
  window.addEventListener('open-recent-file', handleOpenRecentFile);
});

// 从文件路径打开文件
async function openFileFromPath(filePath: string) {
  try {
    console.log('[App] Opening file:', filePath);
    const content = await readTextFile(filePath);
    const fileName = filePath.split(/[/\\]/).pop() || filePath;

    // 检查是否已经打开该文件
    const existingTab = tabs.find(t => t.filePath === filePath);
    if (existingTab) {
      console.log('[App] File already open, switching to tab');
      setActiveTab(existingTab.id);
      // 更新最近文件访问时间
      addRecentFile(filePath);
      return;
    }

    // 创建新标签
    const id = `tab-${Date.now()}`;
    tabs.push({
      id,
      filePath,
      fileName,
      content, // 存储原始内容
      isDirty: false,
    });
    activeTabId.value = id;
    // 添加到最近文件
    addRecentFile(filePath);
    console.log('[App] File opened successfully');
  } catch (error) {
    console.error('[App] Failed to open file:', error);
  }
}

function handleNew() {
  // 创建未命名文件计数器
  let untitledCount = 1;
  const existingUntitled = tabs.filter(t => t.filePath.startsWith('untitled'));
  if (existingUntitled.length > 0) {
    // 找到最大的未命名文件编号
    existingUntitled.forEach(tab => {
      const match = tab.fileName.match(/未命名-(\d+)\.md/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num >= untitledCount) {
          untitledCount = num + 1;
        }
      }
    });
  }

  const id = `tab-${Date.now()}`;
  const fileName = `未命名-${untitledCount}.md`;
  const filePath = `untitled-${id}`;

  tabs.push({
    id,
    filePath,
    fileName,
    content: '', // 空内容
    isDirty: true, // 新建文件标记为未保存状态
  });
  activeTabId.value = id;
}

async function handleOpen() {
  const filePath = await open({
    multiple: false,
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
  });

  if (filePath) {
    const content = await readTextFile(filePath);
    const fileName = filePath.split(/[/\\]/).pop() || filePath;

    // 检查是否已经打开该文件
    const existingTab = tabs.find(t => t.filePath === filePath);
    if (existingTab) {
      setActiveTab(existingTab.id);
      // 更新最近文件访问时间
      addRecentFile(filePath);
      return;
    }

    // 创建新标签
    const id = `tab-${Date.now()}`;
    tabs.push({
      id,
      filePath,
      fileName,
      content, // 存储原始内容
      isDirty: false,
    });
    activeTabId.value = id;
    // 添加到最近文件
    addRecentFile(filePath);
  }
}

async function handleSave() {
  const tab = activeTab.value;
  if (!tab) return;

  if (!tab.filePath || tab.filePath.startsWith('untitled')) {
    handleSaveAs();
    return;
  }

  isSavingFile = true; // 标记正在保存
  try {
    await writeTextFile(tab.filePath, tab.content);
    markTabSaved(tab.id);
    // 延迟清除标志位，确保文件监视的防抖延迟已过
    setTimeout(() => {
      isSavingFile = false;
    }, SAVE_FLAG_CLEAR_DELAY_MS);
  } catch (error) {
    isSavingFile = false;
    throw error;
  }
}

async function handleSaveAs() {
  const tab = activeTab.value;
  if (!tab) return;

  const filePath = await save({
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
  });

  if (filePath) {
    isSavingFile = true; // 标记正在保存
    try {
      await writeTextFile(filePath, tab.content);
      tab.filePath = filePath;
      tab.fileName = filePath.split(/[/\\]/).pop() || filePath;
      markTabSaved(tab.id);
      // 延迟清除标志位，确保文件监视的防抖延迟已过
      setTimeout(() => {
        isSavingFile = false;
      }, SAVE_FLAG_CLEAR_DELAY_MS);
    } catch (error) {
      isSavingFile = false;
      throw error;
    }
  }
}

async function handleCloseTab(id: string) {
  const tab = tabs.find(t => t.id === id);

  // 如果标签页有未保存的修改，显示确认对话框
  if (tab && tab.isDirty) {
    pendingCloseTabId.value = id;
    pendingCloseFileName.value = tab.fileName;
    showUnsavedChangesDialog.value = true;
  } else {
    // 没有未保存的修改，直接关闭
    closeTab(id);
  }
}

// 处理未保存变更对话框的用户选择
async function handleUnsavedChangesChoice(choice: UserChoice) {
  const tabId = pendingCloseTabId.value;
  console.log('[App] handleUnsavedChangesChoice called, choice:', choice, 'tabId:', tabId, 'hasPendingResolve:', !!pendingWindowCloseResolve);

  // 窗口关闭场景：检查是否有待处理的 Promise resolve
  if (pendingWindowCloseResolve) {
    console.log('[App] Window close scenario, resolving promise');
    const resolve = pendingWindowCloseResolve;
    pendingWindowCloseResolve = null;
    resolve(choice);
    // 窗口关闭逻辑会继续处理，包括隐藏对话框
    return;
  }

  // 标签页关闭场景
  console.log('[App] Tab close scenario, processing choice');
  if (!tabId) {
    console.log('[App] No tabId, returning');
    showUnsavedChangesDialog.value = false;
    return;
  }

  const tab = tabs.find(t => t.id === tabId);
  if (!tab) {
    console.log('[App] Tab not found, hiding dialog');
    showUnsavedChangesDialog.value = false;
    return;
  }

  switch (choice) {
    case 'save':
      // 保存文件然后关闭标签页
      console.log('[App] Saving tab:', tab.fileName);
      isSavingFile = true; // 标记正在保存
      try {
        if (tab.filePath && !tab.filePath.startsWith('untitled')) {
          await writeTextFile(tab.filePath, tab.content);
          markTabSaved(tab.id);
        } else {
          // 未命名文件，需要另存为
          const filePath = await save({
            filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
          });
          if (filePath) {
            await writeTextFile(filePath, tab.content);
            tab.filePath = filePath;
            tab.fileName = filePath.split(/[/\\]/).pop() || filePath;
            markTabSaved(tab.id);
          } else {
            // 用户取消了另存为，不关闭标签页
            console.log('[App] User cancelled save as');
            isSavingFile = false;
            showUnsavedChangesDialog.value = false;
            pendingCloseTabId.value = null;
            pendingCloseFileName.value = '';
            return;
          }
        }
        // 延迟清除标志位
        setTimeout(() => {
          isSavingFile = false;
        }, SAVE_FLAG_CLEAR_DELAY_MS);
      } catch (error) {
        isSavingFile = false;
        throw error;
      }
      closeTab(tabId);
      showUnsavedChangesDialog.value = false;
      break;
    case 'discard':
      // 放弃修改，直接关闭标签页
      console.log('[App] Discarding changes for tab:', tab.fileName);
      closeTab(tabId);
      showUnsavedChangesDialog.value = false;
      break;
    case 'cancel':
      // 取消关闭，隐藏对话框
      console.log('[App] User cancelled, hiding dialog');
      showUnsavedChangesDialog.value = false;
      break;
  }

  // 清理状态
  pendingCloseTabId.value = null;
  pendingCloseFileName.value = '';
  console.log('[App] Tab close scenario completed');
}

function handleSelectTab(id: string) {
  setActiveTab(id);
}

function handleContentChange(content: string) {
  if (activeTabId.value) {
    console.log('[App] handleContentChange called for tab:', activeTabId.value, 'content length:', content.length);
    updateTabContent(activeTabId.value, content);
  }
}

function isMarkdownLink(href: string): boolean {
  return href.endsWith('.md') || href.endsWith('.markdown');
}

/**
 * 解析相对路径，正确处理 . 和 ..
 * @param fromPath 基准路径（绝对路径）
 * @param relativePath 相对路径
 * @returns 解析后的绝对路径
 */
function resolvePath(fromPath: string, relativePath: string): string {
  // 检测原始路径分隔符
  const isWindowsPath = /^[A-Za-z]:/.test(fromPath);
  const separator = isWindowsPath ? '\\' : '/';

  // 将路径统一转换为 / 格式进行解析
  const normalizedFrom = fromPath.replace(/\\/g, '/');
  const normalizedRelative = relativePath.replace(/\\/g, '/');

  // 提取基准目录
  const baseDir = normalizedFrom.substring(0, normalizedFrom.lastIndexOf('/'));

  // 使用 URL 解析相对路径
  const resolvedUrl = new URL(normalizedRelative, `file://${baseDir}/`);
  let resolvedPath = resolvedUrl.pathname;

  // Windows 路径处理：移除开头的 /
  if (isWindowsPath) {
    resolvedPath = resolvedPath.substring(1);
  }

  // 恢复原始路径分隔符（Windows 使用 \）
  if (separator === '\\') {
    resolvedPath = resolvedPath.replace(/\//g, '\\');
  }

  return resolvedPath;
}

async function handleClickLink(href: string) {
  if (!isMarkdownLink(href)) {
    return;
  }

  // 先解码 URL 编码的路径
  const decodedHref = decodeURI(href);

  // 处理相对路径
  const activeTabPath = activeTab.value?.filePath;
  let fullPath = decodedHref;

  if (activeTabPath && !decodedHref.match(/^[A-Za-z]:/) && !decodedHref.startsWith('/')) {
    // 相对路径，转换为完整路径
    fullPath = resolvePath(activeTabPath, href);
    fullPath = decodeURI(fullPath);
  }

  // 尝试读取文件
  try {
    const content = await readTextFile(fullPath);

    // 调试日志
    console.log('Opening link:', {
      href: decodedHref,
      activeTabPath,
      fullPath,
      contentLength: content.length,
      contentPreview: content.substring(0, 100)
    });

    // 检查是否已经打开
    const existingTab = tabs.find(t => t.filePath === fullPath);
    if (existingTab) {
      setActiveTab(existingTab.id);
      // 更新最近文件访问时间
      addRecentFile(fullPath);
      return;
    }

    // 创建新标签
    const separatorRegex = /[/\\]/;
    const fileName = decodedHref.split(separatorRegex).pop() || decodedHref;
    const id = `tab-${Date.now()}`;

    const newTab = {
      id,
      filePath: fullPath,
      fileName,
      content, // 存储原始内容
      isDirty: false,
    };

    console.log('Creating new tab:', newTab);

    tabs.push(newTab);
    activeTabId.value = id;
    // 添加到最近文件
    addRecentFile(fullPath);
  } catch (e) {
    console.error('Failed to open link:', e, 'Path:', fullPath);
  }
}

function handleToggleMode() {
  cherryEditorRef.value?.toggleMode();
}

function handleAbout() {
  showAbout.value = true;
}

// 开始监控当前活动文件
async function startWatchingFile() {
  // 停止之前的监控
  stopWatchingFile();

  const tab = activeTab.value;
  if (!tab || !tab.filePath || tab.filePath.startsWith('untitled')) {
    return;
  }

  const filePath = tab.filePath;

  try {
    console.log('[App] Starting to watch file:', filePath);
    unwatchFn = await watchFile(
      filePath,
      async (event) => {
        console.log('[App] File changed:', event, filePath, 'isSavingFile:', isSavingFile);

        // 如果是应用自己保存的，忽略此次变化
        if (isSavingFile) {
          console.log('[App] File change caused by self-save, ignoring');
          return;
        }

        // 动态查找当前文件对应的 tab（避免闭包捕获旧对象）
        const currentTab = tabs.find(t => t.filePath === filePath);
        if (!currentTab) {
          console.log('[App] Tab not found, ignoring file change');
          return;
        }

        // 无论是否有未保存的修改，都弹出对话框让用户确认
        console.log('[App] Showing reload dialog for user confirmation');
        pendingReloadFileName.value = currentTab.fileName;
        pendingReloadFilePath.value = filePath;
        pendingReloadHasUnsavedChanges.value = currentTab.isDirty;
        showFileReloadDialog.value = true;
      },
      {
        delayMs: FILE_WATCH_DEBOUNCE_MS,
      }
    );
  } catch (error) {
    console.error('[App] Failed to watch file:', error);
  }
}

// 停止监控文件
function stopWatchingFile() {
  if (unwatchFn) {
    try {
      unwatchFn();
      console.log('[App] Stopped watching file');
    } catch (error) {
      console.error('[App] Error stopping watch:', error);
    }
    unwatchFn = null;
  }
}

// 重新加载文件内容
async function reloadFile(filePath: string) {
  try {
    const content = await readTextFile(filePath);
    const tab = tabs.find(t => t.filePath === filePath);

    if (tab) {
      tab.content = content; // 存储原始内容
      tab.isDirty = false;
      console.log('[App] File reloaded successfully');
    }
  } catch (error) {
    console.error('[App] Failed to reload file:', error);
  }
}

// 处理重新加载对话框的重新加载操作
async function handleReloadFromFile() {
  if (pendingReloadFilePath.value) {
    await reloadFile(pendingReloadFilePath.value);
  }
  showFileReloadDialog.value = false;
}

// 处理重新加载对话框的忽略操作
function handleIgnoreFileChange() {
  showFileReloadDialog.value = false;
}

// 监听活动标签变化，切换文件监控
watch(activeTab, () => {
  startWatchingFile();
});

// 监听标签页关闭，确保清理监控
watch(
  () => tabs.length,
  () => {
    if (!activeTab.value) {
      stopWatchingFile();
    }
  }
);

// 处理全局键盘快捷键
const handleKeyDown = (event: KeyboardEvent) => {
  // Ctrl+O 或 Cmd+O (Mac) 打开文件
  if ((event.ctrlKey || event.metaKey) && event.key === 'o') {
    event.preventDefault();
    event.stopPropagation();
    handleOpen();
  }
};

// 监听打开最近文件事件
function handleOpenRecentFile(event: Event) {
  const customEvent = event as CustomEvent<{ filePath: string; content: string }>;
  const { filePath, content } = customEvent.detail;
  const fileName = filePath.split(/[/\\]/).pop() || filePath;

  // 检查是否已经打开该文件
  const existingTab = tabs.find(t => t.filePath === filePath);
  if (existingTab) {
    console.log('[App] Recent file already open, switching to tab');
    setActiveTab(existingTab.id);
    return;
  }

  // 创建新标签
  const id = `tab-${Date.now()}`;
  tabs.push({
    id,
    filePath,
    fileName,
    content,
    isDirty: false,
  });
  activeTabId.value = id;
  console.log('[App] Recent file opened successfully');
}

// 卸载前移除键盘事件监听
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('open-recent-file', handleOpenRecentFile);
});
</script>

<template>
  <div class="app">
    <Toolbar @new="handleNew" @open="handleOpen" @save="handleSave" @save-as="handleSaveAs" @toggle-mode="handleToggleMode" @about="handleAbout" />
    <TabBar
      :tabs="tabs"
      :active-tab-id="activeTabId"
      @close="handleCloseTab"
      @select="handleSelectTab"
    />
    <div class="editor-container">
      <CherryEditor
        v-if="activeTab"
        ref="cherryEditorRef"
        :tab="activeTab"
        @update:content="handleContentChange"
        @click-link="handleClickLink"
        @save="handleSave"
      />
      <div v-else class="empty-state">
        <p>打开一个 Markdown 文件开始编辑</p>
        <p class="hint">点击工具栏的"打开"按钮或按 Ctrl+O</p>
      </div>
    </div>
    <AboutDialog :visible="showAbout" @close="showAbout = false" />
    <FileReloadDialog
      :visible="showFileReloadDialog"
      :file-name="pendingReloadFileName"
      :has-unsaved-changes="pendingReloadHasUnsavedChanges"
      @reload="handleReloadFromFile"
      @ignore="handleIgnoreFileChange"
    />
    <UnsavedChangesDialog
      :visible="showUnsavedChangesDialog"
      :file-name="pendingCloseFileName"
      @choice="handleUnsavedChangesChoice"
    />
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.app {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.editor-container {
  flex: 1;
  overflow: hidden;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #999;
  font-size: 16px;
}

.empty-state .hint {
  font-size: 13px;
  color: #bbb;
  margin-top: 8px;
}

/* Cherry Markdown 基础样式 */
.cherry {
  height: 100% !important;
}

.cherry-editor {
  height: 100% !important;
}

/* 暗色主题 */
html.dark .app {
  background-color: #1e1e1e;
  color: #d4d4d4;
}

html.dark .editor-container {
  background-color: #1e1e1e;
}

html.dark .empty-state {
  color: #858585;
}

html.dark .empty-state .hint {
  color: #6a6a6a;
}

/* Mermaid 暗色主题 - 使用更强的选择器 */
html.dark svg[id^="mermaid-"],
html.dark div[data-mermaid-theme],
html.dark .cherry-markdown svg[id^="mermaid-"],
html.dark .cherry-previewer svg[id^="mermaid-"] {
  background-color: transparent !important;
}

/* Mermaid SVG 内部元素 - 修复节点填充色 */
html.dark svg[id^="mermaid-"] .node rect,
html.dark svg[id^="mermaid-"] .node circle,
html.dark svg[id^="mermaid-"] .node ellipse,
html.dark svg[id^="mermaid-"] .node polygon,
html.dark svg[id^="mermaid-"] .node path,
html.dark svg[id^="mermaid-"] rect.actor {
  fill: #2d3748 !important;
  stroke: #8a8a8a !important;
  stroke-width: 2px !important;
}

html.dark svg[id^="mermaid-"] .label,
html.dark svg[id^="mermaid-"] text,
html.dark svg[id^="mermaid-"] tspan,
html.dark svg[id^="mermaid-"] .nodeLabel,
html.dark svg[id^="mermaid-"] .edgeLabel {
  fill: #e0e0e0 !important;
  color: #e0e0e0 !important;
}

/* 修复 edgeLabel 的背景色 */
html.dark svg[id^="mermaid-"] .edgeLabel,
html.dark svg[id^="mermaid-"] foreignObject .edgeLabel {
  background-color: #2d3748 !important;
}

html.dark svg[id^="mermaid-"] .edgeLabel span {
  background-color: #2d3748 !important;
  color: #e0e0e0 !important;
}

html.dark svg[id^="mermaid-"] .edgePath path,
html.dark svg[id^="mermaid-"] path.path,
html.dark svg[id^="mermaid-"] line {
  stroke: #8a8a8a !important;
  stroke-width: 2px !important;
}

html.dark svg[id^="mermaid-"] marker path {
  fill: #8a8a8a !important;
  stroke: #8a8a8a !important;
}

html.dark svg[id^="mermaid-"] .cluster rect {
  fill: #1a202c !important;
  stroke: #6a6a6a !important;
}

/* 如果以上都不行，使用全局 SVG 反转（作为后备方案） */
html.dark .cherry-markdown pre[data-language="mermaid"],
html.dark .cherry-markdown code.language-mermaid {
  filter: invert(0.9) hue-rotate(180deg) !important;
}

html.dark .cherry-markdown pre[data-language="mermaid"] svg,
html.dark .cherry-markdown code.language-mermaid svg {
  filter: invert(0.9) hue-rotate(180deg) !important;
}

/* 强制在预览模式下显示侧边栏 */
.cherry.cherry--no-toolbar .cherry-sidebar {
  display: block !important;
  height: auto !important;
}
</style>
