# Preview 模式侧边栏显示问题调查记录

**日期**: 2025-01-18
**问题**: 在纯预览模式下，Cherry Markdown 的侧边栏（`.cherry-sidebar`）不显示
**影响范围**: Cherry Markdown 编辑器配置

## 问题描述

在 Cherry Markdown Desktop 中，侧边栏配置为 `sidebar: ['theme']` 后：

- **编辑+预览模式** (`edit&preview`): 侧边栏正常显示 ✅
- **纯预览模式** (`previewOnly`): 侧边栏不显示 ❌

用户希望在纯预览模式下也能显示侧边栏，特别是 theme 工具条。

## 调查过程

### 1. 检查项目配置

首先查看了 [CherryEditor.vue](src/components/CherryEditor.vue#L179) 的配置：

```javascript
toolbars: {
  theme: isDark.value ? 'dark' : 'light',
  toolbar: [
    'bold',
    'italic',
    // ... 其他工具栏按钮
  ],
  toolbarRight: ['fullScreen'],
  bubble: ['bold', 'italic', 'underline', 'strikethrough', 'sub', 'sup', 'quote', '|', 'size', 'color'],
  sidebar: ['theme'],  // ← 配置正确
  toc: {
    defaultModel: 'full',
  },
},
```

配置本身是正确的，在 `edit&preview` 模式下侧边栏能正常显示证明了这一点。

### 2. 查阅 Cherry Markdown 源代码

参考项目提供的 Cherry Markdown 源代码位置：
```
D:\Downloads\cherry-markdown-cherry-markdown-0.10.3
```

#### 2.1 JavaScript 逻辑 - Cherry.js

在 [packages/cherry-markdown/src/Cherry.js:377-412](D:/Downloads/cherry-markdown-cherry-markdown-0.10.3/packages/cherry-markdown/src/Cherry.js#L377-L412) 找到了 `switchModel` 方法：

```javascript
switchModel(model = 'edit&preview', showToolbar = true) {
  switch (model) {
    case 'edit&preview':
      if (this.previewer) {
        this.previewer.editOnly();
        this.previewer.recoverPreviewer();
      }
      if (this.toolbar && showToolbar) {
        this.toolbar.showToolbar();
      }
      if (showToolbar) {
        this.wrapperDom.classList.remove('cherry--no-toolbar');  // ← 移除类
      } else {
        this.wrapperDom.classList.add('cherry--no-toolbar');
      }
      break;

    case 'editOnly':
      // ... 类似逻辑
      break;

    case 'previewOnly':
      this.previewer.previewOnly();
      this.toolbar && this.toolbar.previewOnly();
      this.wrapperDom.classList.add('cherry--no-toolbar');  // ← 添加类
      break;
  }
}
```

**关键发现**: 当切换到 `previewOnly` 模式时，会给 `wrapperDom` 添加 `cherry--no-toolbar` CSS 类。

#### 2.2 CSS 样式 - cherry.scss

在 [packages/cherry-markdown/src/sass/cherry.scss:37-42](D:/Downloads/cherry-markdown-cherry-markdown-0.10.3/packages/cherry-markdown/src/sass/cherry.scss#L37-L42) 找到了隐藏规则：

```scss
&.cherry--no-toolbar {
  .cherry-toolbar,
  .cherry-sidebar {   // ← 侧边栏和工具栏一起被隐藏
    height: 0;
    display: none;
  }

  .cherry-editor,
  .cherry-previewer {
    top: 0;
  }
}
```

**关键发现**: `cherry--no-toolbar` 类会同时隐藏工具栏（`.cherry-toolbar`）和侧边栏（`.cherry-sidebar`）。

### 3. 机制分析

| 模式 | `cherry--no-toolbar` 类 | 工具栏显示 | 侧边栏显示 |
|------|------------------------|-----------|-----------|
| `edit&preview` | ❌ 移除 | ✅ 显示 | ✅ 显示 |
| `editOnly` | ❌ 移除 | ✅ 显示 | ✅ 显示 |
| `previewOnly` | ✅ 添加 | ❌ 隐藏 | ❌ 隐藏 |

**结论**: 侧边栏的显示/隐藏不是由 `sidebar` 配置单独控制的，而是与工具栏绑定，统一由 `cherry--no-toolbar` CSS 类控制。

## 解决方案

### 方案对比

| 方案 | 实现难度 | 维护成本 | 推荐度 |
|------|---------|---------|-------|
| 1. CSS 覆盖 | ⭐ 简单 | ⭐ 低 | ⭐⭐⭐⭐⭐ 强烈推荐 |
| 2. 修改源代码 | ⭐⭐⭐ 复杂 | ⭐⭐⭐⭐ 高 | ⭐ 不推荐 |
| 3. 动态操作 DOM | ⭐⭐ 中等 | ⭐⭐ 中 | ⭐⭐ 可行 |

### 方案 1：CSS 覆盖（已采用）

在 [App.vue](src/App.vue) 的 `<style>` 部分添加覆盖规则：

```css
/* 强制在预览模式下显示侧边栏 */
.cherry.cherry--no-toolbar .cherry-sidebar {
  display: block !important;
  height: auto !important;
}
```

**优点**:
- 实现简单，只需添加 3 行 CSS
- 不修改第三方库源代码，升级 Cherry Markdown 版本时不会丢失
- 不影响现有功能

**缺点**:
- 使用了 `!important`，但这是覆盖第三方样式的标准做法

### 方案 2：修改 Cherry Markdown 源代码（不推荐）

修改 `switchModel` 方法，为侧边栏添加独立的显示/隐藏控制：

```javascript
// 伪代码示例
case 'previewOnly':
  this.previewer.previewOnly();
  this.toolbar && this.toolbar.previewOnly();
  this.wrapperDom.classList.add('cherry--no-toolbar');
  // 新增：保持侧边栏显示
  if (this.sidebarDom) {
    this.sidebarDom.style.display = 'block';
  }
  break;
```

**缺点**:
- 需要维护自己的 Cherry Markdown 分支
- 升级版本时需要手动合并修改
- 增加了代码复杂度

### 方案 3：动态操作 DOM（备选）

在 `switchModel` 调用后，手动移除侧边栏的隐藏样式：

```javascript
// CherryEditor.vue 中的示例
cherryEditor.switchModel('previewOnly');
setTimeout(() => {
  const sidebar = document.querySelector('.cherry-sidebar');
  if (sidebar) {
    (sidebar as HTMLElement).style.display = 'block';
  }
}, 0);
```

**缺点**:
- 需要修改多个地方（切换模式时都要处理）
- 代码分散，不易维护
- 可能有时序问题

## 实施结果

采用**方案 1**，在 [App.vue:911-915](src/App.vue#L911-L915) 添加了 CSS 覆盖规则：

```css
/* 强制在预览模式下显示侧边栏 */
.cherry.cherry--no-toolbar .cherry-sidebar {
  display: block !important;
  height: auto !important;
}
```

**测试结果**: ✅ 在纯预览模式下，侧边栏（包括 theme 工具条）正常显示。

## 相关文件

- [CherryEditor.vue](src/components/CherryEditor.vue) - Cherry Markdown 编辑器封装组件
- [App.vue](src/App.vue) - 主应用组件，包含样式覆盖
- Cherry Markdown 源码位置: `D:\Downloads\cherry-markdown-cherry-markdown-0.10.3`

## 经验总结

1. **问题排查技巧**: 当配置项不起作用时，不要只检查配置本身，还要查看库内部的逻辑实现，特别是 CSS 类的控制
2. **CSS 优先级**: 在覆盖第三方库样式时，`!important` 是必要的，但要确保选择器足够具体，避免影响其他元素
3. **方案选择**: 优先选择不修改源代码的方案，降低维护成本
4. **文档化**: 对于第三方库的特殊行为，及时记录在文档中，方便后续维护

## 参考资料

- Cherry Markdown GitHub: https://github.com/Tencent/cherry-markdown
- Cherry Markdown 文档: https://tencent.github.io/cherry-markdown/
