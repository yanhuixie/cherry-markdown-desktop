<script setup lang="ts">
import { onMounted, ref, watch, onBeforeUnmount } from 'vue';
// 使用 cherry-markdown core 版本（不包含内置 mermaid）
import Cherry from 'cherry-markdown/dist/cherry-markdown.core.js';
import { convertFileSrc } from '@tauri-apps/api/core';
import { readFile } from '@tauri-apps/plugin-fs';
import { type TabItem, updateTabEditorMode } from '../stores/tabStore';
import { useTheme } from '../composables/useTheme';
import { useFontSize, type FontSizeLevel } from '../composables/useFontSize';
import { useFontFamily } from '../composables/useFontFamily';
import type { ExportFormat } from './ExportFormatDialog.vue';
import { resolvePath } from '../utils/pathUtils';

// 注意：mermaid 插件已在 main.ts 中通过 initCherryPlugins() 预先注册
// 不需要在此组件中再次注册，避免 "usePlugin should be called before Cherry is instantiated" 错误

const props = defineProps<{
  tab: TabItem | null;
}>();

const emit = defineEmits<{
  (e: 'update:content', content: string): void;
  (e: 'click-link', href: string): void;
  (e: 'save'): void;
}>();

const editorRef = ref<HTMLDivElement | null>(null);
const isDualMode = ref(false);
const { isDark } = useTheme();
const { getSizes, getTocSizes } = useFontSize();
const { isMonospace, initFontFamily } = useFontFamily();
let cherryEditor: Cherry | null = null;
let isInternalChange = false; // 标志位：区分用户编辑和程序更新
let isSwitchingTab = false; // 标志位：标识正在切换标签（防止首次编辑被误判为内部更新）

// 更新 Cherry Markdown 的 CSS 字体变量
const updateFontSizes = () => {
  const sizes = getSizes();
  const tocSizes = getTocSizes();

  // 查找 Cherry Markdown 的容器元素
  const cherryContainer = editorRef.value?.querySelector('.cherry') as HTMLElement;
  if (cherryContainer) {
    // 设置主字体大小变量
    cherryContainer.style.setProperty('--font-size-xs', sizes.xs);
    cherryContainer.style.setProperty('--font-size-sm', sizes.sm);
    cherryContainer.style.setProperty('--font-size-md', sizes.md);
    cherryContainer.style.setProperty('--font-size-lg', sizes.lg);
    cherryContainer.style.setProperty('--font-size-xl', sizes.xl);
    cherryContainer.style.setProperty('--font-size-2xl', sizes['2xl']);
    cherryContainer.style.setProperty('--font-size-3xl', sizes['3xl']);

    // 设置 TOC 字体大小（避免 TOC 拥挤）
    // 直接在 TOC 容器上设置，所有子元素继承
    const tocContainer = cherryContainer.querySelector('.cherry-flex-toc') as HTMLElement;
    if (tocContainer) {
      tocContainer.style.fontSize = tocSizes.item;
      console.log('[CherryEditor] TOC font size set to:', tocSizes.item);
    }
    const tocTitle = cherryContainer.querySelector('.cherry-toc-title') as HTMLElement;
    if (tocTitle) {
      tocTitle.style.fontSize = tocSizes.title;
    }
    console.log('[CherryEditor] Font sizes updated:', sizes, 'TOC sizes:', tocSizes);
  }
};

// 监听字体大小变化事件
const handleFontSizeChange = (event: Event) => {
  const customEvent = event as CustomEvent<{ level: FontSizeLevel }>;
  console.log('[CherryEditor] Font size changed to:', customEvent.detail.level);
  updateFontSizes();
};

// 设置预览区域的字体类型
const updateFontFamily = () => {
  const previewerDom = editorRef.value?.querySelector('.cherry-previewer') as HTMLElement;
  if (previewerDom) {
    if (isMonospace.value) {
      previewerDom.classList.add('cherry-previewer-monospace');
    } else {
      previewerDom.classList.remove('cherry-previewer-monospace');
    }
    console.log('[CherryEditor] Font family updated, isMonospace:', isMonospace.value);
  }
};

// 监听等宽字体变化事件
const handleFontFamilyChange = (event: Event) => {
  const customEvent = event as CustomEvent<{ isMonospace: boolean }>;
  const isMonospaceValue = customEvent.detail.isMonospace;
  console.log('[CherryEditor] Font family changed:', isMonospaceValue);
  
  const previewerDom = editorRef.value?.querySelector('.cherry-previewer') as HTMLElement;
  if (previewerDom) {
    if (isMonospaceValue) {
      previewerDom.classList.add('cherry-previewer-monospace');
    } else {
      previewerDom.classList.remove('cherry-previewer-monospace');
    }
    console.log('[CherryEditor] Font family updated, isMonospace:', isMonospaceValue);
  }
};

const initEditor = async () => {
  if (!editorRef.value || !props.tab) return;

  // 确保 content 是字符串类型
  const content = String(props.tab.content ?? '');

  // 标记为内部更新，避免初始化时触发 afterChange 导致误判为用户编辑
  isInternalChange = true;

  console.log('Initializing Cherry Editor with theme:', isDark.value ? 'dark' : 'light');
  console.log('themeSettings.mainTheme:', isDark.value ? 'abyss' : 'default');

  // 注意：mermaid 插件已在 main.ts 启动时预先注册，无需在此等待

  // 清除可能的主题缓存
  try {
    const themeKey = 'cherry-markdown-theme';
    const storedTheme = localStorage.getItem(themeKey);
    if (storedTheme) {
      console.log('Found stored Cherry theme:', storedTheme);
      // 如果存储的主题与当前主题不一致，清除它
      const expectedTheme = isDark.value ? 'abyss' : 'default';
      if (storedTheme !== expectedTheme) {
        console.log('Clearing stored theme, expected:', expectedTheme);
        localStorage.removeItem(themeKey);
      }
    }
  } catch (e) {
    console.warn('Failed to check/clear theme cache:', e);
  }

  // 仿照 examples/index.html 的完整配置
  cherryEditor = new Cherry({
    el: editorRef.value,
    value: content,
    // externals: {
    //   echarts: window.echarts,
    //   katex: window.katex,
    //   MathJax: window.MathJax,
    // },
    isPreviewOnly: false,
    // Mermaid 配置
    mermaidConfig: {
      theme: isDark.value ? 'dark' : 'default',
    },
    engine: {
      global: {
        htmlAttrWhiteList: 'part|slot',
        flowSessionContext: false,
      },
      syntax: {
        codeBlock: {
          theme: 'twilight',
          lineNumber: true,
          expandCode: true,
          copyCode: true,
          editCode: true,
          changeLang: true,
        },
        table: {
          enableChart: false, // 禁用图表功能
        },
        fontEmphasis: {
          allowWhitespace: false,
        },
        strikethrough: {
          needWhitespace: false,
        },
        emoji: {
          useUnicode: true,
          customResourceURL: 'https://github.githubassets.com/images/icons/emoji/unicode/${code}.png?v8',
          upperCase: false,
        },
        htmlBlock: {
          removeTrailingNewline: false,
        },
        panel: {
          enableJustify: true,
          enablePanel: true,
        },
      },
    },
    toolbars: {
      theme: isDark.value ? 'dark' : 'light',
      toolbar: [
        'bold',
        'italic',
        'strikethrough',
        '|',
        'color',
        'header',
        '|',
        'ol',
        'ul',
        'checklist',
        '|',
        {
          insert: [
            'image',
            'audio',
            'video',
            'link',
            'hr',
            'br',
            'code',
            'formula',
            'toc',
            'table',
          ],
        },
        'graph',
        'togglePreview',
        'codeTheme',
      ],
      toolbarRight: ['fullScreen'],
      bubble: ['bold', 'italic', 'underline', 'strikethrough', 'sub', 'sup', 'quote', '|', 'size', 'color'],
      sidebar: ['theme'],
      toc: {
        defaultModel: 'full',
      },
    },
    editor: {
      defaultModel: 'previewOnly',
      autoSave2Textarea: false,
      codemirror: {
        placeholder: '开始编辑...',
      },
    },
    callback: {
      urlProcessor: (url: string, srcType: string) => {
        // 如果是 http/https/data 链接，直接返回
        if (/^(https?:|data:)/.test(url)) {
          return url;
        }

        // 获取当前文件路径
        const currentFilePath = props.tab?.filePath;

        // 如果是 untitled 文件（未保存），无法解析相对路径
        if (!currentFilePath || currentFilePath.startsWith('untitled')) {
          return url;
        }

        try {
          // 解析相对路径为绝对路径（resolvePath 返回正斜杠格式）
          const absolutePath = resolvePath(currentFilePath, url);

          // 直接使用绝对路径，让 Tauri 的 convertFileSrc 处理
          // 注意：不再移除 Windows 盘符，直接传入完整路径
          const tauriUrl = convertFileSrc(absolutePath);

          return tauriUrl;
        } catch (error) {
          console.error('[CherryEditor] Failed to resolve URL:', error, {
            url,
            srcType,
            currentFilePath,
          });
          return url;
        }
      },
      onClickPreview: (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const anchor = target.closest('A');
        if (anchor) {
          const href = anchor.getAttribute('href');
          if (href) {
            if (href.endsWith('.md') || href.endsWith('.markdown')) {
              e.preventDefault();
              e.stopPropagation();
              emit('click-link', href);
            }
          }
        }
      },
      afterChange: (newContent: string) => {
        if (typeof newContent === 'string') {
          console.log('[CherryEditor] afterChange called, isInternalChange:', isInternalChange, 'isSwitchingTab:', isSwitchingTab, 'tab:', props.tab?.id, 'content length:', newContent.length);

          // 如果是内部变化（初始化或程序设置），不emit
          if (isInternalChange || isSwitchingTab) {
            console.log('[CherryEditor] Skipping emit (internal change)');
            return;
          }

          // 否则是用户编辑，emit更新
          console.log('[CherryEditor] User edit detected, emitting update:content event');
          emit('update:content', newContent);
        }
      },
      afterInit: () => {
        console.log('Cherry Editor initialized');
        // 初始化完成，重置标志
        isInternalChange = false;
        // 应用初始字体大小
        setTimeout(() => {
          updateFontSizes();
        }, 0);
      },
    },
    themeSettings: {
      mainTheme: isDark.value ? 'abyss' : 'default',
    },
  });

  // 设置编辑器和预览器宽度为 50%（仅在双栏编辑模式下）
  // 使用 setTimeout 确保 DOM 已完全渲染
  setTimeout(() => {
    try {
      // @ts-ignore - Cherry Markdown 的内部 API
      if (cherryEditor && cherryEditor.previewer) {
        // 检查当前是否为双栏编辑模式（edit&preview）
        const status = cherryEditor.getStatus();
        // @ts-ignore
        if (status.editor === 'show' && status.previewer === 'show') {
          // @ts-ignore - 使用 setRealLayout 方法设置编辑器和预览器的宽度比例为 50%
          cherryEditor.previewer.setRealLayout('50%', '50%');
          console.log('Layout set to 50% / 50% for edit&preview mode');
        } else {
          console.log('Current mode is not edit&preview, skipping layout setting. Status:', status);
        }
      }
    } catch (e) {
      console.warn('Failed to set layout:', e);
    }
  }, 0);

  // 打印可用的主题（如果有的话）
  setTimeout(() => {
    try {
      // @ts-ignore
      if (cherryEditor && cherryEditor.options && cherryEditor.options.themeSettings) {
        // @ts-ignore
        console.log('Cherry theme settings:', cherryEditor.options.themeSettings);
      }
      // 尝试获取所有可用主题
      // @ts-ignore
      if (window.Cherry && window.Cherry.themes) {
        // @ts-ignore
        console.log('Available Cherry themes:', window.Cherry.themes);
      }
    } catch (e) {
      console.log('Could not get theme info');
    }
  }, 100);
};

watch(
  () => props.tab?.id,
  (newId, oldId) => {
    if (!cherryEditor || !props.tab) return;

    console.log(`[CherryEditor] Tab switched: ${oldId} -> ${newId}`);

    // 保存旧 Tab 的编辑器模式
    if (oldId && cherryEditor) {
      const status = cherryEditor.getStatus();
      // @ts-ignore
      if (status.editor === 'show' && status.previewer === 'show') {
        updateTabEditorMode(oldId, 'edit&preview');
        console.log(`[CherryEditor] Saved mode for tab ${oldId}: edit&preview`);
      } else {
        updateTabEditorMode(oldId, 'previewOnly');
        console.log(`[CherryEditor] Saved mode for tab ${oldId}: previewOnly`);
      }
    }

    // 标记为正在切换标签（防止 setValue 的 afterChange 被误判为用户编辑）
    isSwitchingTab = true;

    // 更新编辑器内容
    const content = String(props.tab.content ?? '');
    const currentValue = cherryEditor.getValue();
    const currentStr = typeof currentValue === 'string' ? currentValue : '';

    if (currentStr !== content) {
      cherryEditor.setValue(content);
    }

    // 延迟重置标志位，确保 setValue 的 afterChange 已经触发完毕
    // 使用 100ms 延迟，确保 Cherry Markdown 内部处理完成
    setTimeout(() => {
      isSwitchingTab = false;
      console.log(`[CherryEditor] Tab switch completed for ${newId}, isSwitchingTab reset to false`);
    }, 100);

    // 恢复新 Tab 的编辑器模式
    const savedMode = props.tab.editorMode;
    console.log(`[CherryEditor] Restoring mode for tab ${newId}:`, savedMode);

    if (savedMode === 'edit&preview') {
      // 延迟执行，确保内容更新完成
      setTimeout(() => {
        if (!cherryEditor) return;
        const currentStatus = cherryEditor.getStatus();
        // @ts-ignore
        if (currentStatus.editor === 'hide' || currentStatus.previewer === 'hide') {
          console.log(`[CherryEditor] Switching to edit&preview mode for tab ${newId}`);
          cherryEditor.switchModel('edit&preview');
          isDualMode.value = true;

          // 设置 50/50 布局
          setTimeout(() => {
            try {
              // @ts-ignore
              if (cherryEditor && cherryEditor.previewer) {
                // @ts-ignore
                cherryEditor.previewer.setRealLayout('50%', '50%');
                console.log(`[CherryEditor] Layout set to 50% / 50% for tab ${newId}`);
              }
            } catch (e) {
              console.warn('[CherryEditor] Failed to set layout:', e);
            }
          }, 50);
        } else {
          isDualMode.value = true;
          console.log(`[CherryEditor] Tab ${newId} already in edit&preview mode`);
        }
      }, 0);
    } else if (savedMode === 'previewOnly' || !savedMode) {
      // 默认为预览模式
      setTimeout(() => {
        if (!cherryEditor) return;
        const currentStatus = cherryEditor.getStatus();
        // @ts-ignore
        if (currentStatus.editor === 'show') {
          console.log(`[CherryEditor] Switching to previewOnly mode for tab ${newId}`);
          cherryEditor.switchModel('previewOnly');
          isDualMode.value = false;
        } else {
          isDualMode.value = false;
          console.log(`[CherryEditor] Tab ${newId} already in previewOnly mode`);
        }
      }, 0);
    }
  }
);

watch(
  () => props.tab?.content,
  (newContent) => {
    if (cherryEditor && newContent !== undefined) {
      // 确保是字符串类型
      const content = String(newContent);

      // 获取当前编辑器的值，确保是字符串
      const currentValue = cherryEditor.getValue();
      const currentStr = typeof currentValue === 'string' ? currentValue : '';

      if (currentStr !== content) {
        // 标记为内部更新（防止 afterChange 被误判为用户编辑）
        isSwitchingTab = true;
        cherryEditor.setValue(content);

        // 延迟重置标志位
        setTimeout(() => {
          isSwitchingTab = false;
          console.log('[CherryEditor] Content update completed, isSwitchingTab reset to false');
        }, 100);
      }
    }
  }
);

// 监听主题变化，重新创建编辑器以应用新主题
watch(isDark, (newValue) => {
  console.log('Theme changed, isDark:', newValue);
  console.log('Will reinitialize with mainTheme:', newValue ? 'abyss' : 'default');

  if (cherryEditor) {
    // 尝试直接设置主题（如果 Cherry 支持）
    try {
      // @ts-ignore
      if (cherryEditor.setTheme) {
        // @ts-ignore
        cherryEditor.setTheme(newValue ? 'abyss' : 'default');
        console.log('Theme set directly');
      } else {
        console.log('setTheme method not available, will destroy and recreate');
        // 销毁旧编辑器
        cherryEditor.destroy();
        cherryEditor = null;

        // 重新创建编辑器
        setTimeout(async () => {
          await initEditor();
        }, 0);
      }
    } catch (e) {
      console.error('Failed to set theme:', e);
      // 销毁旧编辑器
      if (cherryEditor) {
        cherryEditor.destroy();
        cherryEditor = null;
      }

      // 重新创建编辑器
      setTimeout(async () => {
        await initEditor();
      }, 0);
    }
  }
});

// 监听等宽字体状态变化
watch(isMonospace, () => {
  updateFontFamily();
});

// 检查代码块是否超过10行
const isCodeBlockOverLimit = (codeBlock: Element): boolean => {
  // 方法1: 检查是否有折叠遮罩层（最准确）
  const hasMask = codeBlock.querySelector('.cherry-mask-code-block');
  if (hasMask) return true;

  // 方法2: 检查行号数量
  const lineNumbers = codeBlock.querySelectorAll('.cherry-code-block-line-numbers li');
  if (lineNumbers.length > 0) {
    return lineNumbers.length > 10;
  }

  // 方法3: 检查 code 元素的文本行数
  const codeElement = codeBlock.querySelector('code');
  if (codeElement) {
    const lines = codeElement.textContent?.split('\n').length || 0;
    return lines > 10;
  }

  // 默认不超过限制
  return false;
};

// 处理代码块折叠/展开
const handleToggleCodeBlock = (event: Event) => {
  const customEvent = event as CustomEvent<{ expanded: boolean }>;
  const expanded = customEvent.detail.expanded;
  console.log('[CherryEditor] Toggle code blocks, expanded:', expanded);

  const previewerDom = editorRef.value?.querySelector('.cherry-previewer') as HTMLElement;
  if (!previewerDom) {
    console.warn('[CherryEditor] Previewer not found');
    return;
  }

  if (expanded) {
    // 展开所有超过10行的代码块
    const codeBlocks = previewerDom.querySelectorAll('.cherry-code-unExpand');
    let expandedCount = 0;
    codeBlocks.forEach(block => {
      if (isCodeBlockOverLimit(block)) {
        block.classList.remove('cherry-code-unExpand');
        block.classList.add('cherry-code-expand');
        expandedCount++;
      }
    });
    console.log(`[CherryEditor] Expanded ${expandedCount} code blocks (skipped ${codeBlocks.length - expandedCount} small blocks)`);
  } else {
    // 折叠所有超过10行的代码块
    const codeBlocks = previewerDom.querySelectorAll('.cherry-code-expand');
    let collapsedCount = 0;
    codeBlocks.forEach(block => {
      if (isCodeBlockOverLimit(block)) {
        block.classList.remove('cherry-code-expand');
        block.classList.add('cherry-code-unExpand');
        collapsedCount++;
      }
    });
    console.log(`[CherryEditor] Collapsed ${collapsedCount} code blocks (skipped ${codeBlocks.length - collapsedCount} small blocks)`);
  }
};

// 处理键盘快捷键
const handleKeyDown = (event: KeyboardEvent) => {
  // Ctrl+S 或 Cmd+S (Mac) 保存
  if ((event.ctrlKey || event.metaKey) && event.key === 's') {
    event.preventDefault();
    event.stopPropagation();
    emit('save');
  }
};

onMounted(async () => {
  await initEditor();
  // 初始化字体类型
  initFontFamily();
  // 应用初始等宽字体设置（延迟执行确保DOM已渲染）
  setTimeout(() => {
    const previewerDom = editorRef.value?.querySelector('.cherry-previewer') as HTMLElement;
    if (previewerDom && isMonospace.value) {
      previewerDom.classList.add('cherry-previewer-monospace');
      console.log('[CherryEditor] Initial font family applied, isMonospace:', isMonospace.value);
    }
  }, 100);
  // 添加键盘事件监听
  window.addEventListener('keydown', handleKeyDown);
  // 添加字体大小变化监听
  window.addEventListener('font-size-changed', handleFontSizeChange);
  // 添加字体类型变化监听
  window.addEventListener('font-family-changed', handleFontFamilyChange);
  // 添加代码块折叠/展开监听
  window.addEventListener('toggle-code-block', handleToggleCodeBlock);
});

onBeforeUnmount(() => {
  if (cherryEditor) {
    cherryEditor.destroy();
  }
  // 移除键盘事件监听
  window.removeEventListener('keydown', handleKeyDown);
  // 移除字体大小变化监听
  window.removeEventListener('font-size-changed', handleFontSizeChange);
  // 移除字体类型变化监听
  window.removeEventListener('font-family-changed', handleFontFamilyChange);
  // 移除代码块折叠/展开监听
  window.removeEventListener('toggle-code-block', handleToggleCodeBlock);
});

// 暴露获取内容的方法
const getContent = () => {
  const value = cherryEditor?.getValue();
  // 确保返回字符串
  return typeof value === 'string' ? value : '';
};

// 切换编辑/预览模式
const toggleMode = () => {
  if (!cherryEditor || !props.tab) return;

  // 获取当前状态
  const status = cherryEditor.getStatus();
  console.log('[CherryEditor] toggleMode - Current mode:', status);

  // 根据当前模式切换
  if (status.previewer === 'show' && status.editor === 'hide') {
    // 当前是预览模式，切换到编辑+预览模式
    isDualMode.value = true;
    cherryEditor.switchModel('edit&preview');
    // 保存到 Tab
    updateTabEditorMode(props.tab.id, 'edit&preview');
    console.log('[CherryEditor] Switched to edit&preview mode and saved to tab');

    // 切换到编辑+预览模式后，设置布局为 50%
    setTimeout(() => {
      try {
        // @ts-ignore - Cherry Markdown 的内部 API
        if (cherryEditor && cherryEditor.previewer) {
          // @ts-ignore
          cherryEditor.previewer.setRealLayout('50%', '50%');
          console.log('[CherryEditor] Layout set to 50% / 50% after switching to edit&preview');
        }
      } catch (e) {
        console.warn('[CherryEditor] Failed to set layout after mode switch:', e);
      }
    }, 50);
  } else if (status.previewer === 'show' && status.editor === 'show') {
    // 当前是编辑+预览模式，切换到仅预览模式
    isDualMode.value = false;
    cherryEditor.switchModel('previewOnly');
    // 保存到 Tab
    updateTabEditorMode(props.tab.id, 'previewOnly');
    console.log('[CherryEditor] Switched to previewOnly mode and saved to tab');
  } else {
    // 其他情况，切换到编辑+预览模式
    isDualMode.value = true;
    cherryEditor.switchModel('edit&preview');
    // 保存到 Tab
    updateTabEditorMode(props.tab.id, 'edit&preview');
    console.log('[CherryEditor] Switched to edit&preview mode (from other state) and saved to tab');

    // 切换到编辑+预览模式后，设置布局为 50%
    setTimeout(() => {
      try {
        // @ts-ignore - Cherry Markdown 的内部 API
        if (cherryEditor && cherryEditor.previewer) {
          // @ts-ignore
          cherryEditor.previewer.setRealLayout('50%', '50%');
          console.log('[CherryEditor] Layout set to 50% / 50% after switching to edit&preview');
        }
      } catch (e) {
        console.warn('[CherryEditor] Failed to set layout after mode switch:', e);
      }
    }, 50);
  }
};

// 导出内容为指定格式（返回内容而非直接导出）
const getExportContent = (format: ExportFormat): { content: string | Blob; filename: string; mimeType: string } => {
  if (!cherryEditor) {
    throw new Error('Editor not initialized');
  }

  const defaultFilename = props.tab?.fileName.replace(/\.(md|markdown)$/i, '') || 'document';

  switch (format) {
    case 'markdown':
      // 获取 Markdown 源内容
      const mdContent = cherryEditor.getMarkdown();
      return {
        content: mdContent,
        filename: defaultFilename,
        mimeType: 'text/markdown',
      };

    case 'html':
      // 获取渲染后的 HTML 内容
      const htmlContent = cherryEditor.getHtml();
      // 包装成完整的 HTML 文档
      const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${defaultFilename}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    pre { background: #f6f8fa; padding: 16px; overflow: auto; }
    code { background: #f6f8fa; padding: 2px 6px; }
    pre code { background: none; padding: 0; }
    img { max-width: 100%; }
  </style>
</head>
<body>
${htmlContent}
</body>
</html>`;
      return {
        content: fullHtml,
        filename: defaultFilename,
        mimeType: 'text/html',
      };

    case 'pdf':
      // PDF 需要使用打印对话框，这里返回特殊标记
      return {
        content: 'USE_PRINT_DIALOG',
        filename: defaultFilename,
        mimeType: 'application/pdf',
      };

    case 'png':
      // PNG 需要异步处理，返回特殊标记
      return {
        content: 'USE_ASYNC_EXPORT',
        filename: defaultFilename,
        mimeType: 'image/png',
      };

    case 'docx':
      // DOCX 需要异步处理，返回特殊标记
      return {
        content: 'USE_ASYNC_EXPORT',
        filename: defaultFilename,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      };

    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
};

// 异步导出 PNG 图片（参考官方源码实现）
const exportPNG = async (): Promise<{ blob: Blob; filename: string }> => {
  if (!cherryEditor || !editorRef.value) {
    throw new Error('Editor not initialized');
  }

  // 动态导入 html2canvas
  const html2canvas = (await import('html2canvas')).default;

  // 获取预览区域 DOM
  const previewerDom = editorRef.value.querySelector('.cherry-previewer') as HTMLElement;
  if (!previewerDom) {
    throw new Error('Previewer not found');
  }

  const defaultFilename = props.tab?.fileName.replace(/\.(md|markdown)$/i, '') || 'document';

  // 参考 Cherry 官方的 getReadyToExport 实现
  return new Promise<{ blob: Blob; filename: string }>((resolve, reject) => {
    // 1. 克隆预览区域
    const cherryPreviewer = previewerDom.cloneNode(true) as HTMLElement;
    cherryPreviewer.className = cherryPreviewer.className.replace('cherry-previewer--hidden', '');

    // 2. 设置样式为完整显示
    cherryPreviewer.style.width = '100%';
    cherryPreviewer.style.height = 'auto';
    cherryPreviewer.style.maxHeight = 'none';

    // 3. 修复 MathJax 辅助元素
    const mmls = cherryPreviewer.querySelectorAll('mjx-assistive-mml');
    mmls.forEach((e) => {
      if (e instanceof HTMLElement) e.style.setProperty('visibility', 'hidden');
    });

    // 4. 创建包装器并复制主题类名
    const cherryWrapper = document.createElement('div');
    cherryWrapper.className = 'cherry-export-wrapper';
    const cherryInstance = previewerDom.closest('.cherry');
    if (cherryInstance) {
      cherryWrapper.className = `${cherryWrapper.className} ${cherryInstance.className}`;
    }

    cherryWrapper.appendChild(cherryPreviewer);
    document.body.appendChild(cherryWrapper);

    // 5. 保存原始 body overflow
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'visible';

    // 6. 清理函数
    const cleanup = () => {
      cherryWrapper.remove();
      document.body.style.overflow = bodyOverflow;
    };

    // 7. 滚动到顶部
    window.scrollTo(0, 0);

    // 8. 去掉 audio 和 video 标签
    cherryPreviewer.innerHTML = cherryPreviewer.innerHTML.replace(/<audio [^>]+?>([^\n]*?)<\/audio>/g, '$1');
    cherryPreviewer.innerHTML = cherryPreviewer.innerHTML.replace(/<video [^>]+?>([^\n]*?)<\/video>/g, '$1');

    // 9. 强制展开所有代码块
    cherryPreviewer.innerHTML = cherryPreviewer.innerHTML.replace(
      /class="cherry-code-unExpand("| )/g,
      'class="cherry-code-expand$1',
    );

    // 10. 使用 html2canvas 生成图片
    html2canvas(cherryPreviewer, {
      allowTaint: true,
      height: cherryPreviewer.clientHeight,
      width: cherryPreviewer.clientWidth,
      scrollY: 0,
      scrollX: 0,
    }).then((canvas) => {
      // 11. 转换为 PNG 格式（修复官方源码使用 JPEG 的问题）
      canvas.toBlob((blob: Blob | null) => {
        cleanup();
        if (blob) {
          resolve({ blob, filename: defaultFilename });
        } else {
          reject(new Error('Failed to generate PNG image'));
        }
      }, 'image/png');
    }).catch((error) => {
      cleanup();
      reject(error);
    });
  });
};

/**
 * 将图片路径转换为 base64 data URL
 * 支持相对路径和绝对路径
 */
const convertImageToBase64 = async (imagePath: string): Promise<string> => {
  try {
    // 如果已经是 data URL 或 http URL，直接返回
    if (/^(data:|https?:)/.test(imagePath)) {
      return imagePath;
    }

    // 获取当前文件路径
    const currentFilePath = props.tab?.filePath;

    // 如果是 untitled 文件（未保存），无法解析相对路径
    if (!currentFilePath || currentFilePath.startsWith('untitled')) {
      console.warn('[CherryEditor] Cannot resolve image path: no valid file path', { imagePath, currentFilePath });
      return imagePath;
    }

    // 解析相对路径为绝对路径
    const absolutePath = resolvePath(currentFilePath, imagePath);

    // 读取图片文件为二进制数据
    const imageBytes = await readFile(absolutePath);

    // 转换为 base64
    const base64 = arrayBufferToBase64(imageBytes);

    // 根据文件扩展名确定 MIME 类型
    const ext = absolutePath.split('.').pop()?.toLowerCase() || 'png';
    const mimeTypes: Record<string, string> = {
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'webp': 'image/webp',
      'bmp': 'image/bmp',
    };
    const mimeType = mimeTypes[ext] || 'image/png';

    // 返回 data URL
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error('[CherryEditor] Failed to convert image to base64:', error, { imagePath });
    // 失败时返回原始路径
    return imagePath;
  }
};

/**
 * 将 Uint8Array 转换为 base64 字符串
 */
const arrayBufferToBase64 = (buffer: Uint8Array): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

/**
 * 预处理 Markdown 内容，将相对路径图片转换为 base64
 */
const preprocessMarkdownImages = async (markdown: string): Promise<string> => {
  // 匹配 Markdown 图片语法：![alt](path) 或 ![alt](path "title")
  const imageRegex = /!\[(.*?)\]\((.+?)(?:\s+"(.*?)")?\)/g;

  const processedImages: Array<{ original: string; replacement: string }> = [];
  let match;

  // 收集所有图片
  while ((match = imageRegex.exec(markdown)) !== null) {
    const [fullMatch, _alt, imagePath, _title] = match;

    // 跳过已经是 data URL 或 http URL 的图片
    if (/^(data:|https?:)/.test(imagePath)) {
      continue;
    }

    processedImages.push({
      original: fullMatch,
      replacement: fullMatch, // 稍后替换
    });
  }

  // 如果没有相对路径图片，直接返回原始内容
  if (processedImages.length === 0) {
    return markdown;
  }

  console.log(`[CherryEditor] Found ${processedImages.length} local images, converting to base64...`);

  // 转换所有图片为 base64
  const conversions = await Promise.all(
    processedImages.map(async (item) => {
      const match = item.original.match(/!\[(.*?)\]\((.+?)(?:\s+"(.*?)")?\)/);
      if (!match) return item;

      const [, alt, imagePath, title] = match;
      const base64Url = await convertImageToBase64(imagePath);

      // 重建图片语法
      let newImageSyntax = `![${alt}](${base64Url}`;
      if (title) {
        newImageSyntax += ` "${title}"`;
      }
      newImageSyntax += ')';

      return { ...item, replacement: newImageSyntax };
    })
  );

  // 替换所有图片
  let result = markdown;
  conversions.forEach(({ original, replacement }) => {
    result = result.replace(original, replacement);
  });

  console.log('[CherryEditor] Image preprocessing completed');
  return result;
};

/**
 * 预处理 Markdown 中的 mermaid 代码块
 * 修复格式问题，特别是 subgraph、C4 context 和 HTML 标签的兼容性
 */
const preprocessMermaidBlocks = (markdown: string): string => {
  // 临时禁用所有预处理逻辑，直接返回原始内容
  console.log('[CherryEditor] preprocessMermaidBlocks DISABLED - returning original markdown');
  return markdown;
};

// 解析 Markdown 并导出为 Word 文档
const exportDOCX = async (): Promise<{ blob: Blob; filename: string }> => {
  if (!cherryEditor) {
    throw new Error('Editor not initialized');
  }

  // 使用我们自己的 mdast2docx 模块
  const { toDocx, mermaidPlugin, imagePlugin, htmlPlugin, listPlugin, mathPlugin, tablePlugin, emojiPlugin } = await import('../utils/mdast2docx');
  const { fromMarkdown } = await import('mdast-util-from-markdown');
  const { gfmTable } = await import('micromark-extension-gfm-table');
  const { gfmTableFromMarkdown } = await import('mdast-util-gfm-table');

  // 获取 Markdown 内容
  let markdown = cherryEditor.getMarkdown();
  const defaultFilename = props.tab?.fileName.replace(/\.(md|markdown)$/i, '') || 'document';

  // 预处理：将相对路径图片转换为 base64
  console.log('[CherryEditor] Preprocessing images for DOCX export...');
  markdown = await preprocessMarkdownImages(markdown);

  // 预处理：修复 mermaid 代码块
  console.log('[CherryEditor] Preprocessing mermaid blocks for DOCX export...');
  markdown = preprocessMermaidBlocks(markdown);

  // 将 markdown 转换为 MDAST（支持 GFM 表格）
  const mdast = fromMarkdown(markdown, {
    extensions: [gfmTable()],
    mdastExtensions: [gfmTableFromMarkdown()],
  });

  // 调试：打印 MDAST 结构（仅打印前1000行避免日志过长）
  // console.log('[CherryEditor] MDAST 结构（前1000行）:', JSON.stringify(mdast, null, 2).slice(0, 5000));

  // 调试：查找表格节点
  const tableNodes = mdast.children.filter((node: any) => node.type === 'table');
  console.log('[CherryEditor] 找到', tableNodes.length, '个表格节点');

  // 配置插件
  const plugins = [
    mermaidPlugin(),  // Mermaid 图表支持
    imagePlugin(),    // 图片支持
    htmlPlugin(),     // HTML 转换
    listPlugin(),     // 列表转换
    mathPlugin(),     // 数学公式
    tablePlugin(),    // 表格支持
    emojiPlugin(),    // Emoji 支持
  ];

  console.log('[CherryEditor] 配置的插件数量:', plugins.length);
  console.log('[CherryEditor] 插件列表:', plugins.map(p => p?.name || typeof p));

  // 使用 md2docx 将 MDAST 转换为 DOCX
  // 参数: mdast, docxProps, sectionProps, outputType
  const blob = await toDocx(
    mdast,
    undefined,  // docxProps (使用默认)
    { plugins },  // sectionProps - 传递插件数组
    undefined   // outputType (默认 "blob")
  ) as Blob;

  return { blob, filename: defaultFilename };
};

// 导出内容（使用 Cherry 的 export 方法用于 PDF）
const exportContent = (format: ExportFormat, filename?: string) => {
  if (!cherryEditor) {
    console.warn('[CherryEditor] Cannot export: editor not initialized');
    return;
  }

  const defaultFilename = filename || props.tab?.fileName.replace(/\.(md|markdown)$/i, '') || 'document';

  // PDF 使用 Cherry 的打印对话框
  if (format === 'pdf') {
    // @ts-ignore - Cherry Markdown 的 export API
    cherryEditor.export('pdf', defaultFilename);
  }
};

defineExpose({ getContent, toggleMode, exportContent, getExportContent, exportPNG, exportDOCX });
</script>

<template>
  <div ref="editorRef" class="cherry-editor" :class="{ 'dual-mode': isDualMode }"></div>
</template>

<style scoped>
.cherry-editor {
  width: 100%;
  height: 100%;
}
</style>

<style>
/* 全局样式：预览区域等宽字体 */
.cherry-previewer-monospace,
.cherry-previewer-monospace .cherry-markdown {
  font-family: 'Fira Code', 'Source Code Pro', 'Consolas', 'Monaco', 'Courier New', monospace !important;
}

/* 确保所有子元素也使用等宽字体 */
.cherry-previewer-monospace * {
  font-family: inherit !important;
}

/* 确保pre标签也使用等宽字体 */
.cherry-previewer-monospace pre,
.cherry-previewer-monospace code {
  font-family: 'Fira Code', 'Source Code Pro', 'Consolas', 'Monaco', 'Courier New', monospace !important;
}

/* 覆盖Cherry Markdown代码块的字体（处理highlight.js等语法高亮） */
.cherry-previewer-monospace pre[class*="language-"],
.cherry-previewer-monospace code[class*="language-"] {
  font-family: 'Fira Code', 'Source Code Pro', 'Consolas', 'Monaco', 'Courier New', monospace !important;
  font-size: 14px !important;
}

/* 覆盖Cherry Markdown代码块容器的字体 */
.cherry-previewer-monospace .cherry-code-block {
  font-family: 'Fira Code', 'Source Code Pro', 'Consolas', 'Monaco', 'Courier New', monospace !important;
}

.cherry-previewer-monospace .cherry-code-block-content {
  font-family: 'Fira Code', 'Source Code Pro', 'Consolas', 'Monaco', 'Courier New', monospace !important;
}

/* 代码块内的所有元素 */
.cherry-previewer-monospace .cherry-code-block * {
  font-family: inherit !important;
}

/* 预览区域图片自适应宽度 */
.cherry-previewer img {
  max-width: 85%;
  height: auto;
}
</style>
