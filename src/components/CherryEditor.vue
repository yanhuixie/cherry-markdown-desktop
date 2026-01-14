<script setup lang="ts">
import { onMounted, ref, watch, onBeforeUnmount } from 'vue';
import Cherry from 'cherry-markdown';
import { type TabItem, updateTabEditorMode } from '../stores/tabStore';
import { useTheme } from '../composables/useTheme';

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
let cherryEditor: Cherry | null = null;
let isInternalChange = false; // 标志位：区分用户编辑和程序更新
let pendingContentChangeCount = 0; // 计数器：跟踪待处理的内容变化（用于 setValue）

const initEditor = () => {
  if (!editorRef.value || !props.tab) return;

  // 确保 content 是字符串类型
  const content = String(props.tab.content ?? '');

  // 标记为内部更新，避免初始化时触发 afterChange 导致误判为用户编辑
  isInternalChange = true;

  console.log('Initializing Cherry Editor with theme:', isDark.value ? 'dark' : 'light');
  console.log('themeSettings.mainTheme:', isDark.value ? 'abyss' : 'default');

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
      onClickPreview: (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'A') {
          const href = target.getAttribute('href');
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
          console.log('[CherryEditor] afterChange called, isInternalChange:', isInternalChange, 'pendingContentChangeCount:', pendingContentChangeCount, 'tab:', props.tab?.id, 'content length:', newContent.length);

          // 如果是内部变化（初始化或程序设置），不emit
          if (isInternalChange || pendingContentChangeCount > 0) {
            console.log('[CherryEditor] Skipping emit (internal change)');
            if (pendingContentChangeCount > 0) {
              pendingContentChangeCount--;
            }
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

    // 更新编辑器内容
    const content = String(props.tab.content ?? '');
    const currentValue = cherryEditor.getValue();
    const currentStr = typeof currentValue === 'string' ? currentValue : '';

    if (currentStr !== content) {
      pendingContentChangeCount++; // 标记为内部更新
      cherryEditor.setValue(content);
    }

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
        pendingContentChangeCount++; // 标记为内部更新
        cherryEditor.setValue(content);
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
        setTimeout(() => {
          initEditor();
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
      setTimeout(() => {
        initEditor();
      }, 0);
    }
  }
});

// 处理键盘快捷键
const handleKeyDown = (event: KeyboardEvent) => {
  // Ctrl+S 或 Cmd+S (Mac) 保存
  if ((event.ctrlKey || event.metaKey) && event.key === 's') {
    event.preventDefault();
    event.stopPropagation();
    emit('save');
  }
};

onMounted(() => {
  initEditor();
  // 添加键盘事件监听
  window.addEventListener('keydown', handleKeyDown);
});

onBeforeUnmount(() => {
  if (cherryEditor) {
    cherryEditor.destroy();
  }
  // 移除键盘事件监听
  window.removeEventListener('keydown', handleKeyDown);
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

defineExpose({ getContent, toggleMode });
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
