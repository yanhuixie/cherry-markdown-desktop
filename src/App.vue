<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { readTextFile, writeTextFile, writeFile } from '@tauri-apps/plugin-fs';
import { open as openDialog, save } from '@tauri-apps/plugin-dialog';
import { invoke } from './utils/tauriInvoke'; // 使用带错误拦截的 invoke 包装器
import { getCurrentWindow } from '@tauri-apps/api/window';
import { tabs, activeTabId, closeTab, closeLeftTabs, closeRightTabs, closeAllTabs, setActiveTab, updateTabContent, markTabSaved, addRecentFile, createTabItem, isTabDirty, type TabItem } from './stores/tabStore';
import { fileWatchManager } from './stores/fileWatchManager';
import { FileSyncStatus, transitionOnExternalModify } from './stores/fileSyncStatus';
import TabBar from './components/TabBar.vue';
import Toolbar from './components/Toolbar.vue';
import CherryEditor from './components/CherryEditor.vue';
import AboutDialog from './components/AboutDialog.vue';
import FileReloadDialog from './components/FileReloadDialog.vue';
import FileDeletedDialog from './components/FileDeletedDialog.vue';
import UnsavedChangesDialog, { type UserChoice } from './components/UnsavedChangesDialog.vue';
import ExportFormatDialog, { type ExportFormat } from './components/ExportFormatDialog.vue';
import LoadingDialog from './components/LoadingDialog.vue';
import ConfirmDialog, { type ConfirmChoice } from './components/ConfirmDialog.vue';
import ErrorDialog from './components/ErrorDialog.vue';
import Sidebar from './components/Sidebar/Sidebar.vue';
import { openFolder, sidebarState } from './stores/sidebarStore';
import { useFileOpener } from './composables/useFileOpener';
import {
  resolvePath,
  identifyPath,
  PathType,
  extractLocalPathFromAssetUrl
} from './utils/pathUtils';

// 文件监视相关常量
const FILE_WATCH_DEBOUNCE_MS = 500; // 文件监视的防抖延迟（毫秒）
const SAVE_FLAG_CLEAR_DELAY_MS = FILE_WATCH_DEBOUNCE_MS + 100; // 保存标志位清除延迟（比防抖延迟多 100ms 确保安全）

// 文件重新加载对话框状态
const showFileReloadDialog = ref(false);
const pendingReloadFileName = ref('');
const pendingReloadFilePath = ref('');
const pendingReloadHasUnsavedChanges = ref(false);
const pendingReloadTabs = ref<Set<string>>(new Set()); // 待处理的标签页 ID 集合

// 文件删除对话框状态
const showFileDeletedDialog = ref(false);
const pendingDeletedFileName = ref('');
const pendingDeletedFilePath = ref('');
const pendingDeletedHasUnsavedChanges = ref(false);

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

// 导出格式对话框状态
const showExportFormatDialog = ref(false);

// 加载对话框状态
const showLoadingDialog = ref(false);
const loadingMessage = ref('');

// 关闭所有标签确认对话框状态
const showCloseAllConfirmDialog = ref(false);
const closeAllConfirmMessage = ref('');

// 错误提示对话框状态
const showErrorDialog = ref(false);
const errorDialogTitle = ref('');
const errorMessage = ref('');

// Cherry Editor 组件引用
const cherryEditorRef = ref<InstanceType<typeof CherryEditor> | null>(null);

// 设置单实例文件打开监听器
useFileOpener((filePath: string, content: string) => {
  console.log('[App] Opening file from single instance:', filePath);

  // 检查是否已经打开该文件
  const existingTab = tabs.find(t => t.filePath === filePath);
  if (existingTab) {
    console.log('[App] File already open, switching to tab');
    setActiveTab(existingTab.id);
    return;
  }

  // 创建新标签
  const id = `tab-${Date.now()}`;
  const newTab = createTabItem(id, filePath, content, false);
  tabs.push(newTab);
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
      const dirtyTabs = tabs.filter(t => isTabDirty(t));
      console.log('[App] Dirty tabs count:', dirtyTabs.length);

      if (dirtyTabs.length > 0) {
        // 阻止窗口关闭
        console.log('[App] Preventing window close, showing dialogs');
        event.preventDefault();

        // 异步处理未保存的标签页
        (async () => {
          try {
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
                fileWatchManager.setSaving(true, tab.filePath, tab.content); // 标记正在保存
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
                      fileWatchManager.setSaving(false, tab.filePath);
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
                    fileWatchManager.setSaving(false, tab.filePath);
                  }, SAVE_FLAG_CLEAR_DELAY_MS);
                } catch (error) {
                  fileWatchManager.setSaving(false, tab.filePath);
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
          } catch (error) {
            // 窗口关闭处理错误边界
            console.error('[App] Window close handler error:', error);
            shouldAllowWindowClose = false;
            // 恢复状态
            pendingCloseTabId.value = null;
            pendingCloseFileName.value = '';
            showUnsavedChangesDialog.value = false;
            // 显示错误提示
            errorDialogTitle.value = '关闭失败';
            errorMessage.value = `保存文件时发生错误：${error}`;
            showErrorDialog.value = true;
          }
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

  // 添加侧边栏事件监听
  window.addEventListener('sidebar-open-file', handleSidebarOpenFile);
  window.addEventListener('sidebar-open-folder', handleSidebarOpenFolder);
});

// 从文件路径打开文件
async function openFileFromPath(filePath: string) {
  try {
    console.log('[App] Opening file:', filePath);
    const content = await readTextFile(filePath);

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
    const newTab = createTabItem(id, filePath, content, false);
    tabs.push(newTab);
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

  // 创建新标签（新建文件标记为 UNNAMED 状态）
  const newTab = createTabItem(id, filePath, '', true);
  newTab.fileName = fileName; // 覆盖文件名
  tabs.push(newTab);
  activeTabId.value = id;
}

async function handleOpen() {
  const filePath = await openDialog({
    multiple: false,
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
  });

  if (filePath) {
    const content = await readTextFile(filePath);

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
    const newTab = createTabItem(id, filePath, content, false);
    tabs.push(newTab);
    activeTabId.value = id;
    // 添加到最近文件
    addRecentFile(filePath);
  }
}

// 从 Toolbar 打开文件夹
async function handleOpenFolderFromToolbar() {
  try {
    const folderPath = await openDialog({
      directory: true,
      title: '选择文件夹',
    });

    if (folderPath) {
      await openFolder(folderPath as string);
      // 切换到文件夹浏览器标签
      sidebarState.activeTab = 'fileExplorer';
      console.log('[App] Folder opened from toolbar:', folderPath);
    }
  } catch (error) {
    console.error('[App] Failed to open folder:', error);
    errorDialogTitle.value = '打开文件夹失败';
    errorMessage.value = `无法打开文件夹：\n\n${error}`;
    showErrorDialog.value = true;
  }
}

async function handleSave() {
  const tab = activeTab.value;
  if (!tab) return;

  // 远程 URL 文件、untitled 文件需要执行"另存为"
  if (!tab.filePath || tab.filePath.startsWith('untitled') || /^https?:\/\//.test(tab.filePath)) {
    handleSaveAs();
    return;
  }

  // 标记正在保存，并记录内容哈希用于比对
  fileWatchManager.setSaving(true, tab.filePath, tab.content);
  try {
    await writeTextFile(tab.filePath, tab.content);
    markTabSaved(tab.id);
    // 保存完成后清除标志位和哈希（使用延迟确保文件监视的防抖延迟已过）
    setTimeout(() => {
      fileWatchManager.setSaving(false, tab.filePath);
    }, SAVE_FLAG_CLEAR_DELAY_MS);
  } catch (error) {
    fileWatchManager.setSaving(false, tab.filePath);
    throw error;
  }
}

async function handleSaveAs() {
  const tab = activeTab.value;
  if (!tab) return;

  // 显示导出格式选择对话框
  showExportFormatDialog.value = true;
}

// 处理导出格式选择
async function handleExportFormatSelect(format: ExportFormat) {
  const tab = activeTab.value;
  if (!tab || !cherryEditorRef.value) return;

  console.log('[App] Export format selected:', format);

  try {
    switch (format) {
      case 'markdown': {
        // Markdown：使用 Tauri 保存对话框
        const filePath = await save({
          filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
        });

        if (filePath) {
          fileWatchManager.setSaving(true, filePath, tab.content);
          try {
            await writeTextFile(filePath, tab.content);
            tab.filePath = filePath;
            tab.fileName = filePath.split(/[/\\]/).pop() || filePath;
            markTabSaved(tab.id);
            alert(`✅ Markdown 文件已保存到：\n${filePath}`);
            setTimeout(() => {
              fileWatchManager.setSaving(false, filePath);
            }, SAVE_FLAG_CLEAR_DELAY_MS);
          } catch (error) {
            fileWatchManager.setSaving(false, filePath);
            alert(`❌ 保存 Markdown 文件失败：${error}`);
            throw error;
          }
        }
        break;
      }

      case 'html': {
        // HTML：获取内容并使用 Tauri 保存对话框
        const exportData = cherryEditorRef.value.getExportContent('html');
        const filePath = await save({
          filters: [{ name: 'HTML', extensions: ['html'] }],
          defaultPath: `${exportData.filename}.html`,
        });

        if (filePath) {
          try {
            await writeTextFile(filePath, exportData.content as string);
            alert(`✅ HTML 文件已保存到：\n${filePath}`);
          } catch (error) {
            alert(`❌ 保存 HTML 文件失败：${error}`);
            throw error;
          }
        }
        break;
      }

      case 'docx': {
        // DOCX：生成 Word 文档并保存
        loadingMessage.value = '正在生成 Word 文档，请稍候...';
        showLoadingDialog.value = true;

        // 等待 DOM 更新，确保 loading dialog 能够渲染
        await nextTick();

        // 延迟一小段时间，让 loading dialog 完全渲染
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
          const { blob, filename } = await cherryEditorRef.value.exportDOCX();
          showLoadingDialog.value = false;

          // 让用户选择保存路径
          const filePath = await save({
            filters: [{ name: 'Word 文档', extensions: ['docx'] }],
            defaultPath: `${filename}.docx`,
          });

          if (filePath) {
            // 将 Blob 转换为 Uint8Array
            const arrayBuffer = await blob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            // 写入二进制文件
            await writeFile(filePath, uint8Array);
            alert(`✅ Word 文档已保存到：\n${filePath}`);
          }
        } catch (error) {
          showLoadingDialog.value = false;
          alert(`❌ 导出 Word 文档失败：${error}`);
          throw error;
        }
        break;
      }

      case 'pdf': {
        // PDF：使用 Cherry 的打印对话框（浏览器限制）
        // 用户已在 ExportFormatDialog 中看到说明
        cherryEditorRef.value.exportContent('pdf');
        break;
      }

      case 'png': {
        // PNG：生成完整内容的图片并保存
        loadingMessage.value = '正在生成 PNG 图片，请稍候...';
        showLoadingDialog.value = true;

        // 等待 DOM 更新，确保 loading dialog 能够渲染
        await nextTick();

        // 延迟一小段时间，让 loading dialog 完全渲染
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
          const { blob, filename } = await cherryEditorRef.value.exportPNG();
          showLoadingDialog.value = false;

          // 让用户选择保存路径
          const filePath = await save({
            filters: [{ name: 'PNG 图片', extensions: ['png'] }],
            defaultPath: `${filename}.png`,
          });

          if (filePath) {
            // 将 Blob 转换为 Uint8Array
            const arrayBuffer = await blob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            // 写入二进制文件
            await writeFile(filePath, uint8Array);
            alert(`✅ PNG 图片已保存到：\n${filePath}`);
          }
        } catch (error) {
          showLoadingDialog.value = false;
          alert(`❌ 导出 PNG 失败：${error}`);
          throw error;
        }
        break;
      }

      default:
        throw new Error(`不支持的导出格式: ${format}`);
    }
  } catch (error) {
    console.error('[App] Export failed:', error);
    // 错误已经在上面的 catch 块中处理了
  }

  showExportFormatDialog.value = false;
}

async function handleCloseTab(id: string) {
  const tab = tabs.find(t => t.id === id);

  // 如果标签页有未保存的修改，显示确认对话框
  if (tab && isTabDirty(tab)) {
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
      fileWatchManager.setSaving(true, tab.filePath, tab.content); // 标记正在保存
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
            fileWatchManager.setSaving(false, tab.filePath);
            showUnsavedChangesDialog.value = false;
            pendingCloseTabId.value = null;
            pendingCloseFileName.value = '';
            return;
          }
        }
        // 延迟清除标志位
        setTimeout(() => {
          fileWatchManager.setSaving(false, tab.filePath);
        }, SAVE_FLAG_CLEAR_DELAY_MS);
      } catch (error) {
        fileWatchManager.setSaving(false, tab.filePath);
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

// 批量关闭标签页
function handleCloseLeftTabs(id: string) {
  closeLeftTabs(id);
}

function handleCloseRightTabs(id: string) {
  closeRightTabs(id);
}

function handleCloseAllTabs() {
  // 检查是否有 dirty 标签页
  const dirtyTabs = tabs.filter(t => isTabDirty(t));
  const dirtyCount = dirtyTabs.length;

  if (dirtyCount > 0) {
    closeAllConfirmMessage.value = `确定要关闭所有标签页吗？\n\n注意：有 ${dirtyCount} 个文件包含未保存的修改，这些修改将会丢失。`;
  } else {
    closeAllConfirmMessage.value = '确定要关闭所有标签页吗？';
  }

  // 显示确认对话框
  showCloseAllConfirmDialog.value = true;
}

// 处理关闭所有标签确认对话框的选择
function handleCloseAllConfirmChoice(choice: ConfirmChoice) {
  if (choice === 'confirm') {
    closeAllTabs();
  }
  showCloseAllConfirmDialog.value = false;
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

async function handleClickLink(href: string) {
  if (!isMarkdownLink(href)) {
    return;
  }

  // 先解码 URL 编码的路径
  const decodedHref = decodeURI(href);

  // 识别路径类型
  const pathType = identifyPath(decodedHref);

  // 获取当前活动标签的路径
  const activeTabPath = activeTab.value?.filePath;

  try {
    let filePath: string;
    let content: string;
    let fileName: string;

    switch (pathType) {
      case PathType.ASSET_URL: {
        // asset.localhost URL：提取本地路径
        const localPath = extractLocalPathFromAssetUrl(decodedHref);

        console.log('[App] Converting asset.localhost URL to local path:', {
          url: decodedHref,
          localPath
        });

        filePath = localPath;
        content = await readTextFile(filePath);
        fileName = localPath.split(/[/\\]/).pop() || localPath;
        break;
      }

      case PathType.LOCAL:
      case PathType.RELATIVE: {
        // 本地文件或相对路径：解析为绝对路径
        let fullPath = decodedHref;
        if (activeTabPath && !decodedHref.match(/^[A-Za-z]:/) && !decodedHref.startsWith('/')) {
          fullPath = resolvePath(activeTabPath, href);
          fullPath = decodeURI(fullPath);
        }

        filePath = fullPath;
        content = await readTextFile(filePath);
        fileName = fullPath.split(/[/\\]/).pop() || fullPath;
        break;
      }

      case PathType.REMOTE_URL: {
        // 真正的远程 URL：使用 fetch 下载
        const response = await fetch(decodedHref);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        filePath = decodedHref; // 保存原始 URL 作为路径
        content = await response.text();
        fileName = decodedHref.split(/[/\\]/).pop() || decodedHref;
        break;
      }

      default:
        console.warn('[App] Unsupported path type for Markdown link:', pathType, 'href:', decodedHref);
        return;
    }

    // 检查是否已经打开
    const existingTab = tabs.find(t => t.filePath === filePath);
    if (existingTab) {
      setActiveTab(existingTab.id);
      // 更新最近文件访问时间
      addRecentFile(filePath);
      return;
    }

    // 创建新标签
    const id = `tab-${Date.now()}`;
    const newTab = createTabItem(id, filePath, content, false);

    console.log('[App] Opening Markdown file:', {
      pathType,
      filePath,
      fileName,
      contentLength: content.length
    });

    tabs.push(newTab);
    activeTabId.value = id;
    addRecentFile(filePath);
  } catch (e) {
    console.error('[App] Failed to open Markdown link:', e, {
      href: decodedHref,
      pathType
    });

    // 显示错误提示
    const errorMsg = e?.toString() || '未知错误';
    if (errorMsg.includes('os error 2') ||
        errorMsg.includes('No such file') ||
        errorMsg.includes('cannot find') ||
        errorMsg.includes('系统找不到指定的文件')) {
      errorDialogTitle.value = '文件不存在';
      errorMessage.value = `无法打开链接指向的文件：\n\n${decodedHref}\n\n该文件可能已被删除或移动。`;
    } else if (errorMsg.includes('HTTP')) {
      errorDialogTitle.value = '网络错误';
      errorMessage.value = `无法访问远程链接：\n\n${decodedHref}\n\n${errorMsg}`;
    } else {
      errorDialogTitle.value = '打开链接失败';
      errorMessage.value = `无法打开链接：\n\n${decodedHref}\n\n${errorMsg}`;
    }
    showErrorDialog.value = true;
  }
}

// 处理锚点链接错误
function handleAnchorError(anchorId: string) {
  console.warn('[App] Anchor not found:', anchorId);
  errorDialogTitle.value = '锚点不存在';
  errorMessage.value = `文档中找不到名为 "${anchorId}" 的锚点。\n\n该锚点可能已被删除或链接有误。`;
  showErrorDialog.value = true;
}

// 处理其他链接错误
function handleLinkError(href: string, reason: string) {
  console.warn('[App] Link error:', href, reason);
  errorDialogTitle.value = '无效链接';
  errorMessage.value = '这是一个无效或不支持的链接。\n\n请在 Markdown 文档中检查链接是否正确。';
  showErrorDialog.value = true;
}

function handleToggleMode() {
  cherryEditorRef.value?.toggleMode();
}

function handleAbout() {
  showAbout.value = true;
}

/**
 * 处理文件变化回调
 * @param filePath 文件路径
 * @param tabId 标签页 ID
 */
function handleFileChanged(filePath: string, tabId: string) {
  const tab = tabs.find(t => t.filePath === filePath && t.id === tabId);
  if (!tab) {
    console.log('[App] Tab not found for file change:', filePath, 'tabId:', tabId);
    return;
  }

  // 根据当前状态决定新的状态
  const newStatus = transitionOnExternalModify(tab.syncStatus);

  // 更新状态
  tab.syncStatus = newStatus;

  console.log('[App] File changed, status updated:', {
    filePath,
    tabId: tab.id,
    oldStatus: tab.syncStatus,
    newStatus,
  });

  // 如果是当前活动标签，立即显示对话框
  if (tab.id === activeTabId.value) {
    showReloadDialog(tab);
  } else {
    // 非活动标签，记录到待处理列表
    pendingReloadTabs.value.add(tab.id);
    console.log('[App] Tab not active, added to pending list:', tab.id);
  }
}

/**
 * 显示重新加载对话框
 */
function showReloadDialog(tab: TabItem) {
  pendingReloadFileName.value = tab.fileName;
  pendingReloadFilePath.value = tab.filePath;
  pendingReloadHasUnsavedChanges.value = isTabDirty(tab);
  showFileReloadDialog.value = true;
}

/**
 * 为标签页启动监控
 */
async function startWatchForTab(tab: { id: string; filePath: string; fileName: string; syncStatus: FileSyncStatus }): Promise<void> {
  if (!tab.filePath) return;

  const success = await fileWatchManager.startWatch(
    tab as any, // FileWatchManager 需要 TabItem，这里传入兼容的对象
    handleFileChanged
  );

  if (success) {
    console.log('[App] Started watch for tab:', tab.id, tab.filePath);
  }
}

/**
 * 停止标签页的监控
 */
function stopWatchForTab(tabId: string): void {
  fileWatchManager.stopWatchByTabId(tabId);
  console.log('[App] Stopped watch for tab:', tabId);
}

// 重新加载文件内容
async function reloadFile(filePath: string) {
  try {
    let content: string;

    // 根据文件路径类型选择不同的加载方式
    if (/^https?:\/\//.test(filePath)) {
      // 远程 URL：使用 fetch
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      content = await response.text();
    } else {
      // 本地文件：使用 readTextFile
      content = await readTextFile(filePath);
    }

    const tab = tabs.find(t => t.filePath === filePath);

    if (tab) {
      tab.content = content; // 存储原始内容
      // 重新加载后，状态变为已同步
      tab.syncStatus = FileSyncStatus.SYNCED;
      tab.lastSyncedModified = Date.now();
      console.log('[App] File reloaded successfully');
    }
  } catch (error) {
    console.error('[App] Failed to reload file:', error);

    // 检查是否是文件删除错误（本地文件）
    if (!/^https?:\/\//.test(filePath)) {
      const errorMessage = error?.toString() || '';
      // 检测常见的文件删除错误模式
      if (errorMessage.includes('os error 2') || // 文件不存在
          errorMessage.includes('No such file') ||
          errorMessage.includes('cannot find') ||
          errorMessage.includes('系统找不到指定的文件')) {
        console.log('[App] File has been deleted, showing dialog');

        // 查找对应的标签页
        const tab = tabs.find(t => t.filePath === filePath);
        if (tab) {
          // 显示文件删除对话框
          pendingDeletedFileName.value = tab.fileName;
          pendingDeletedFilePath.value = filePath;
          pendingDeletedHasUnsavedChanges.value = isTabDirty(tab);
          showFileDeletedDialog.value = true;
        }
        return;
      }
    }

    // 其他错误，显示通用错误提示
    alert(`重新加载文件失败：\n${error}`);
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

// 处理文件删除对话框的"保留"操作
function handleKeepDeletedFile() {
  showFileDeletedDialog.value = false;
}

// 处理文件删除对话框的"关闭"操作
function handleCloseDeletedFile() {
  const tab = tabs.find(t => t.filePath === pendingDeletedFilePath.value);
  if (tab) {
    closeTab(tab.id);
  }
  showFileDeletedDialog.value = false;
}

// 处理全局键盘快捷键
const handleKeyDown = (event: KeyboardEvent) => {
  // 禁用刷新快捷键：F5, Ctrl+R, Ctrl+Shift+R, Command+R (Mac), Command+Shift+R (Mac)
  if (
    event.key === 'F5' ||
    (event.key === 'r' || event.key === 'R') && (event.ctrlKey || event.metaKey)
  ) {
    console.log('[App] 阻止刷新快捷键:', event.key);
    event.preventDefault();
    event.stopPropagation();
    return;
  }

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

  // 检查是否已经打开该文件
  const existingTab = tabs.find(t => t.filePath === filePath);
  if (existingTab) {
    console.log('[App] Recent file already open, switching to tab');
    setActiveTab(existingTab.id);
    return;
  }

  // 创建新标签
  const id = `tab-${Date.now()}`;
  const newTab = createTabItem(id, filePath, content, false);
  tabs.push(newTab);
  activeTabId.value = id;
  console.log('[App] Recent file opened successfully');
}

// 处理侧边栏文件打开事件
async function handleSidebarOpenFile(event: Event) {
  const customEvent = event as CustomEvent<{ filePath: string }>;
  const { filePath } = customEvent.detail;

  try {
    const content = await readTextFile(filePath);

    // 检查是否已经打开该文件
    const existingTab = tabs.find(t => t.filePath === filePath);
    if (existingTab) {
      setActiveTab(existingTab.id);
      addRecentFile(filePath);
      return;
    }

    // 创建新标签
    const id = `tab-${Date.now()}`;
    const newTab = createTabItem(id, filePath, content, false);
    tabs.push(newTab);
    activeTabId.value = id;
    addRecentFile(filePath);
    console.log('[App] Sidebar file opened successfully:', filePath);
  } catch (error) {
    console.error('[App] Failed to open file from sidebar:', error);
    errorDialogTitle.value = '打开文件失败';
    errorMessage.value = `无法打开文件：\n\n${filePath}\n\n${error}`;
    showErrorDialog.value = true;
  }
}

// 处理侧边栏文件夹打开事件
async function handleSidebarOpenFolder() {
  try {
    const folderPath = await openDialog({
      directory: true,
      title: '选择文件夹',
    });

    if (folderPath) {
      await openFolder(folderPath as string);
      console.log('[App] Folder opened from sidebar:', folderPath);
    }
  } catch (error) {
    console.error('[App] Failed to open folder:', error);
    errorDialogTitle.value = '打开文件夹失败';
    errorMessage.value = `无法打开文件夹：\n\n${error}`;
    showErrorDialog.value = true;
  }
}

// === 监控管理 ===

// 监听 tabs 数组变化，自动启动/停止监控
watch(
  () => tabs.map(t => ({ id: t.id, filePath: t.filePath })),
  async (newTabs, oldTabs) => {
    if (!oldTabs) {
      // 首次加载，为所有标签启动监控
      console.log('[App] Initial load, starting watches for all tabs');
      for (const { id } of newTabs) {
        const tab = tabs.find(t => t.id === id);
        if (tab) {
          await startWatchForTab(tab);
        }
      }
      return;
    }

    // 检测新增的标签
    const added = newTabs.filter(newTab =>
      !oldTabs.some(oldTab => oldTab.id === newTab.id)
    );

    for (const { id } of added) {
      const tab = tabs.find(t => t.id === id);
      if (tab) {
        await startWatchForTab(tab);
      }
    }

    // 检测移除的标签
    const removed = oldTabs.filter(oldTab =>
      !newTabs.some(newTab => newTab.id === oldTab.id)
    );

    for (const { id } of removed) {
      stopWatchForTab(id);
    }
  },
  { deep: true }
);

// 监听活动标签变化
watch(activeTabId, (newId, _oldId) => {
  if (!newId) return;

  // 如果有待处理的待加载标签
  if (pendingReloadTabs.value.has(newId)) {
    // 先从待处理列表移除，避免重复处理
    pendingReloadTabs.value.delete(newId);

    // 检查 tab 是否仍然存在
    const tab = tabs.find(t => t.id === newId);
    if (tab && (tab.syncStatus === FileSyncStatus.EXTERNALLY_MODIFIED ||
                tab.syncStatus === FileSyncStatus.CONFLICT)) {
      showReloadDialog(tab);
    }
  }
});

// 监听标签页关闭，确保清理监控
watch(
  () => tabs.length,
  (_newLength, _oldLength) => {
    if (!activeTab.value) {
      console.log('[App] No active tab, clearing pending reload tabs');
      pendingReloadTabs.value.clear();
    }
  }
);

// 卸载前移除键盘事件监听和清理监控
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('open-recent-file', handleOpenRecentFile);
  window.removeEventListener('sidebar-open-file', handleSidebarOpenFile);
  window.removeEventListener('sidebar-open-folder', handleSidebarOpenFolder);
  // 停止所有文件监控
  fileWatchManager.stopAll();
  console.log('[App] All file watches stopped on unmount');
});
</script>

<template>
  <div class="app">
    <!-- 侧边栏 -->
    <Sidebar />

    <!-- 主内容区域 -->
    <div class="main-content">
      <Toolbar @new="handleNew" @open="handleOpen" @open-folder="handleOpenFolderFromToolbar" @save="handleSave" @save-as="handleSaveAs" @toggle-mode="handleToggleMode" @about="handleAbout" />
      <TabBar
        :tabs="tabs"
        :active-tab-id="activeTabId"
        @close="handleCloseTab"
        @select="handleSelectTab"
        @close-left="handleCloseLeftTabs"
        @close-right="handleCloseRightTabs"
        @close-all="handleCloseAllTabs"
      />
      <div class="editor-container">
        <CherryEditor
          v-if="activeTab"
          ref="cherryEditorRef"
          :tab="activeTab"
          @update:content="handleContentChange"
          @click-link="handleClickLink"
          @save="handleSave"
          @anchor-error="handleAnchorError"
          @link-error="handleLinkError"
        />
        <div v-else class="empty-state">
          <p>打开一个 Markdown 文件开始编辑</p>
          <p class="hint">点击工具栏的"打开"按钮或按 Ctrl+O</p>
        </div>
      </div>
    </div>

    <AboutDialog :visible="showAbout" @close="showAbout = false" />
    <LoadingDialog :visible="showLoadingDialog" :message="loadingMessage" />
    <ExportFormatDialog
      :visible="showExportFormatDialog"
      @select="handleExportFormatSelect"
      @close="showExportFormatDialog = false"
    />
    <FileReloadDialog
      :visible="showFileReloadDialog"
      :file-name="pendingReloadFileName"
      :has-unsaved-changes="pendingReloadHasUnsavedChanges"
      @reload="handleReloadFromFile"
      @ignore="handleIgnoreFileChange"
    />
    <FileDeletedDialog
      :visible="showFileDeletedDialog"
      :file-name="pendingDeletedFileName"
      :file-path="pendingDeletedFilePath"
      :has-unsaved-changes="pendingDeletedHasUnsavedChanges"
      @keep="handleKeepDeletedFile"
      @close="handleCloseDeletedFile"
    />
    <UnsavedChangesDialog
      :visible="showUnsavedChangesDialog"
      :file-name="pendingCloseFileName"
      @choice="handleUnsavedChangesChoice"
    />
    <ConfirmDialog
      :visible="showCloseAllConfirmDialog"
      title="关闭所有标签页"
      :message="closeAllConfirmMessage"
      confirm-text="确定"
      cancel-text="取消"
      @choice="handleCloseAllConfirmChoice"
    />
    <ErrorDialog
      :visible="showErrorDialog"
      :title="errorDialogTitle"
      :message="errorMessage"
      @close="showErrorDialog = false"
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
  width: 100%;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.main-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow: hidden;
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

html.dark .main-content {
  background-color: #1e1e1e;
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

/* Mermaid 11.12.2 原生支持暗色主题，无需 CSS Hack */
/* 主题通过 mermaidConfig.theme: 'dark' 配置 */
/* 参考：CherryEditor.vue 中的 mermaidConfig 配置 */

/* 强制在预览模式下显示侧边栏 */
.cherry.cherry--no-toolbar .cherry-sidebar {
  display: block !important;
  height: auto !important;
}
</style>
