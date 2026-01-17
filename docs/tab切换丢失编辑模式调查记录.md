# Tab 切换丢失编辑模式调查记录

## 初始需求

用户要求调整 Cherry Markdown 编辑器在双栏编辑模式（edit&preview）下的布局比例，从默认的不合理比例改为左右各 50%。

要求必须参考 cherry-markdown 源代码和例子，找到最符合组件预期的方案。

## 第一阶段：实现 50/50 布局

### 解决方案

通过研究 cherry-markdown v0.10.3 源代码（位于 `D:\Downloads\cherry-markdown-cherry-markdown-0.10.3\packages\cherry-markdown\src\Previewer.js`），发现 `setRealLayout(editorPercentage, previewerPercentage)` 方法。

在 `CherryEditor.vue` 的 `afterInit` 回调中：

```javascript
setTimeout(() => {
  if (cherryEditor && cherryEditor.previewer) {
    cherryEditor.previewer.setRealLayout('50%', '50%');
    console.log('Layout set to 50% / 50% for edit&preview mode');
  }
}, 0);
```

### 问题 1：内容少的文件正常，内容多的文件在预览模式显示两栏

**现象**：
- 内容极少（几个字）的 MD 文件：预览模式正常（单栏）
- 内容较多的 MD 文件：预览模式显示两栏（左栏正常，右栏空白）

**原因**：无条件调用 `setRealLayout()`，即使在 `previewOnly` 模式下也调用了。

**解决方案**：添加模式检查，只在 `edit&preview` 模式下设置布局：

```javascript
setTimeout(() => {
  if (cherryEditor && cherryEditor.previewer) {
    const status = cherryEditor.getStatus();
    if (status.editor === 'show' && status.previewer === 'show') {
      cherryEditor.previewer.setRealLayout('50%', '50%');
    } else {
      console.log('Current mode is not edit&preview, skipping layout setting');
    }
  }
}, 0);
```

## 第二阶段：Tab 切换丢失编辑模式

### 问题 2：切换标签页后编辑模式丢失

**现象**：
1. Tab A 从预览模式切换到编辑模式
2. 切换到 Tab B
3. 切换回 Tab A
4. Tab A 的编辑模式丢失，又变回预览模式

**原因分析**：
- `isDualMode` 是组件的本地状态，不是 per-tab 的状态
- `App.vue` 中使用了 `:key="activeTab.id"`，导致每次切换标签都会销毁并重新创建组件，丢失状态

### 解决方案：Tab 级别的模式持久化

#### 1. 在 TabItem 接口中添加 `editorMode` 字段

**修改文件**：`src/stores/tabStore.ts`

```typescript
export interface TabItem {
  id: string;
  filePath: string;
  fileName: string;
  content: string;
  isDirty: boolean;
  editorMode?: 'previewOnly' | 'edit&preview'; // 新增字段
}

export function updateTabEditorMode(id: string, mode: 'previewOnly' | 'edit&preview'): void {
  const tab = tabs.find(t => t.id === id);
  if (tab) {
    tab.editorMode = mode;
  }
}
```

#### 2. 在标签切换时保存和恢复模式

**修改文件**：`src/components/CherryEditor.vue`

在 `watch(() => props.tab?.id)` 中：

```javascript
// 保存旧 Tab 的编辑器模式
if (oldId && cherryEditor) {
  const status = cherryEditor.getStatus();
  if (status.editor === 'show' && status.previewer === 'show') {
    updateTabEditorMode(oldId, 'edit&preview');
  } else {
    updateTabEditorMode(oldId, 'previewOnly');
  }
}

// 恢复新 Tab 的编辑器模式
const savedMode = props.tab.editorMode;
if (savedMode === 'edit&preview') {
  setTimeout(() => {
    if (!cherryEditor) return;
    const currentStatus = cherryEditor.getStatus();
    if (currentStatus.editor === 'hide' || currentStatus.previewer === 'hide') {
      cherryEditor.switchModel('edit&preview');
      isDualMode.value = true;

      // 设置 50/50 布局
      setTimeout(() => {
        if (cherryEditor && cherryEditor.previewer) {
          cherryEditor.previewer.setRealLayout('50%', '50%');
        }
      }, 50);
    }
  }, 0);
} else if (savedMode === 'previewOnly' || !savedMode) {
  setTimeout(() => {
    if (!cherryEditor) return;
    const currentStatus = cherryEditor.getStatus();
    if (currentStatus.editor === 'show') {
      cherryEditor.switchModel('previewOnly');
      isDualMode.value = false;
    }
  }, 0);
}
```

#### 3. 移除 :key 属性

**修改文件**：`src/App.vue`

```vue
<!-- 之前 -->
<CherryEditor
  v-if="activeTab"
  ref="cherryEditorRef"
  :key="activeTab.id"
  :tab="activeTab"
/>

<!-- 修改后 -->
<CherryEditor
  v-if="activeTab"
  ref="cherryEditorRef"
  :tab="activeTab"
/>
```

移除 `:key` 后，CherryEditor 组件实例会被复用，而不是每次切换都销毁重建。

#### 4. 在 toggleMode 中保存模式

**修改文件**：`src/components/CherryEditor.vue`

```javascript
const toggleMode = () => {
  // ...
  if (status.previewer === 'show' && status.editor === 'hide') {
    isDualMode.value = true;
    cherryEditor.switchModel('edit&preview');
    updateTabEditorMode(props.tab.id, 'edit&preview');
  } else if (status.previewer === 'show' && status.editor === 'show') {
    isDualMode.value = false;
    cherryEditor.switchModel('previewOnly');
    updateTabEditorMode(props.tab.id, 'previewOnly');
  }
};
```

## 第三阶段：Tab 切换后文件被错误标记为 Dirty

### 问题 3：文件在切换标签页后被标记为 dirty，但实际内容未修改

**现象**：
1. 打开 test.md（31 字符，末尾有 4 个换行符）
2. 切换到另一个 tab
3. 切换回 test.md
4. test.md 被标记为 dirty 状态
5. 但用户实际上没有编辑任何内容

**原因分析**：

Cherry Editor 会自动规范化内容：
- 文件原始内容：`"内容\n\n\n\n"`（末尾 4 个换行符，31 字符）
- Cherry Editor 规范化后：`"内容\n\n\n"`（末尾 3 个换行符，27 字符）

切换标签页时：
1. `setValue(31字符原始内容)` 被调用
2. Cherry Editor 规范化并返回 27 字符
3. 触发 `afterChange` 回调
4. 比较后发现内容不同，标记为 dirty

### 尝试过的解决方案

#### 方案 1：normalizeContent 用于存储

**失败原因**：用户反馈这是错误的，因为改变了文件的实际内容，而不仅仅是用于比较。

**用户原话**："你做规范化的目的是什么？只是为了判定dirty的比对用，还是实际改变了md文档的内容？"

#### 方案 2：normalizeContent 仅用于比较

在 `afterChange` 回调中：
```javascript
const normalizedOld = normalizeContent(oldContent);
const normalizedNew = normalizeContent(newContent);
if (normalizedOld !== normalizedNew) {
  emit('update:content', newContent);
}
```

**失败原因**：`trimEnd()` 只去除到第一个非空白字符，而不是去除所有末尾换行符。`normalizeContent()` 去除所有末尾换行符，两者比较仍然不等。

#### 方案 3：读取文件时立即规范化

**失败原因**：用户明确表示不要改变文件内容，只在比较时使用规范化。

#### 方案 4：使用 isInternalChange 标志位

在 `setValue()` 时：
```javascript
isInternalChange = true;
cherryEditor.setValue(content);
setTimeout(() => { isInternalChange = false; }, 0);
```

**失败原因**：`setTimeout(fn, 0)` 在下一个事件循环执行，但 Cherry Editor 的 `afterChange` 可能在更晚的时候触发，此时 `isInternalChange` 已经被重置为 `false`。

#### 方案 5：使用 pendingContentChangeCount 计数器

```javascript
let pendingContentChangeCount = 0;

// setValue 时
pendingContentChangeCount++;
cherryEditor.setValue(content);

// afterChange 时
if (pendingContentChangeCount > 0) {
  pendingContentChangeCount--;
  return;
}
emit('update:content', newContent);
```

**失败原因**：初始化时 `value: content` 也会触发 `afterChange`，但此时 `pendingContentChangeCount = 0`，会被误判为用户编辑。

**修正**：初始化时设置 `isInternalChange = true`，在 `afterInit` 中重置为 `false`。

### 最终解决方案

结合 `isInternalChange` 标志位和 `pendingContentChangeCount` 计数器：

**修改文件**：`src/components/CherryEditor.vue`

```javascript
let isInternalChange = false; // 标志位：区分用户编辑和程序更新
let pendingContentChangeCount = 0; // 计数器：跟踪待处理的内容变化

// 初始化时
const initEditor = () => {
  // 标记为内部更新，避免初始化时触发 afterChange
  isInternalChange = true;

  cherryEditor = new Cherry({
    // ...
    afterChange: (newContent: string) => {
      if (typeof newContent === 'string') {
        // 如果是内部变化（初始化或程序设置），不emit
        if (isInternalChange || pendingContentChangeCount > 0) {
          if (pendingContentChangeCount > 0) {
            pendingContentChangeCount--;
          }
          return;
        }

        // 否则是用户编辑，emit更新
        emit('update:content', newContent);
      }
    },
    afterInit: () => {
      // 初始化完成，重置标志
      isInternalChange = false;
    },
  });
};

// setValue 时
pendingContentChangeCount++;
cherryEditor.setValue(content);
```

**核心逻辑**：
1. 初始化时设置 `isInternalChange = true`，所有初始化期间的 `afterChange` 都会被跳过
2. `afterInit` 回调中重置 `isInternalChange = false`
3. `setValue()` 时 `pendingContentChangeCount++`
4. `afterChange` 中检查 `isInternalChange || pendingContentChangeCount > 0`，如果是则跳过 emit

## 最终状态

所有问题都已解决：

1. ✅ 编辑/预览模式 50/50 布局
2. ✅ Tab 切换时保持编辑模式
3. ✅ 切换 Tab 不会错误标记为 dirty
4. ✅ 用户编辑正确标记为 dirty

## 关键文件修改清单

### src/stores/tabStore.ts
- 添加 `editorMode` 字段到 `TabItem` 接口
- 添加 `updateTabEditorMode()` 函数
- 简化 `updateTabContent()` 逻辑（直接标记 dirty，不做内容比较）

### src/components/CherryEditor.vue
- 添加 `isInternalChange` 和 `pendingContentChangeCount` 变量
- 初始化时设置 `isInternalChange = true`
- `afterInit` 中重置 `isInternalChange = false`
- `afterChange` 中检查 `isInternalChange || pendingContentChangeCount > 0`
- 标签切换时保存和恢复编辑器模式
- `toggleMode` 中保存模式到 tab

### src/App.vue
- 移除 `<CherryEditor :key="activeTab.id">` 的 `:key` 属性

## 经验教训

1. **内容规范化问题**：Cherry Editor 会自动规范化内容（去除末尾多余换行符），需要正确区分用户编辑和程序更新。

2. **标志位时机问题**：使用 `setTimeout(() => { flag = false; }, 0)` 不可靠，因为异步回调可能在更晚的时候触发。应该使用计数器或者初始化标志位来确保正确性。

3. **组件复用 vs 销毁重建**：使用 `:key` 会导致组件销毁重建，丢失状态。移除 `:key` 让组件复用，但需要手动管理状态（如编辑器模式）。

4. **用户反馈**：不要试图通过内容比对来判断文件是否 dirty，而是通过编辑动作来判断。只要用户编辑了，就应该标记为 dirty，即使内容最后和原来一样。

5. **简化逻辑**：最终方案非常简单——使用标志位区分内部更新和用户编辑，而不是复杂的内容比较逻辑。

## 参考资料

- Cherry Markdown v0.10.3 源代码：`D:\Downloads\cherry-markdown-cherry-markdown-0.10.3\packages\cherry-markdown\src\Previewer.js`
- Cherry Markdown v0.10.3 例子：`D:\Downloads\cherry-markdown-cherry-markdown-0.10.3\examples`
- 项目文档：`d:\develop\runlefei\CherryMarkdownDesktop\CLAUDE.md`
