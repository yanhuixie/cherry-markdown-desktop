# Mermaid 渲染问题调查报告

## 问题描述

Cherry Markdown Desktop 中，部分语法正确的 mermaid 图表会被识别为 JavaScript 原文输出，而不是渲染为图形。

**问题示例**：
以下使用 `flowchart` 语法的复杂图表无法正确渲染：

```mermaid
flowchart TD
    A[开始] --> B{用户状态?}
    B -->|已登录| C[检查会话有效性]
    B -->|未登录| D[登录页面]
    # ... (复杂逻辑)
```

而简单的图表通常可以正常工作。

---

## 调查时间线

### 1. 初步调查 - Cherry Markdown 源码分析

**分析文件**：
- `D:\Downloads\cherry-markdown-cherry-markdown-0.10.3\packages\cherry-markdown\src\addons\cherry-code-block-mermaid-plugin.js`
- `D:\Downloads\cherry-markdown-cherry-markdown-0.10.3\packages\cherry-markdown\src\core\hooks\CodeBlock.js`

**发现**：

1. **Mermaid 插件注册机制** ([cherry-code-block-mermaid-plugin.js:62-74](D:/Downloads/cherry-markdown-cherry-markdown-0.10.3/packages/cherry-markdown/src/addons/cherry-code-block-mermaid-plugin.js#L62-L74))
   ```javascript
   static install(cherryOptions, ...args) {
     mergeWith(cherryOptions, {
       engine: {
         syntax: {
           codeBlock: {
             customRenderer: {
               mermaid: new MermaidCodeEngine(...args),
             },
           },
         },
       },
     });
   }
   ```

2. **代码块识别逻辑** ([CodeBlock.js:458-471](D:/Downloads/cherry-markdown-cherry-markdown-0.10.3/packages/cherry-markdown/src/core/hooks/CodeBlock.js#L458-L471))
   ```javascript
   if (this.isInternalCustomLangCovered($lang)) {
     cacheCode = this.parseCustomLanguage($lang, $code, {...});
   } else {
     // 如果不是自定义语言，回退到普通代码块渲染
     if (!lang || !Prism.languages[lang]) lang = 'javascript';
   }
   ```

3. **Mermaid 渲染版本检测** ([cherry-code-block-mermaid-plugin.js:139-141](D:/Downloads/cherry-markdown-cherry-markdown-0.10.3/packages/cherry-markdown/src/addons/cherry-code-block-mermaid-plugin.js#L139-L141))
   ```javascript
   isAsyncRenderVersion() {
     return this.mermaidAPIRefs.render.length === 3;
   }
   ```

4. **API 初始化要求** ([cherry-code-block-mermaid-plugin.js:117-135](D:/Downloads/cherry-markdown-cherry-markdown-0.10.3/packages/cherry-markdown/src/addons/cherry-code-block-mermaid-plugin.js#L117-L135))
   ```javascript
   constructor(mermaidOptions = {}) {
     // 需要 mermaid.mermaidAPI 或 window.mermaid.mermaidAPI
     if (!mermaidAPI && !window.mermaidAPI &&
         (!mermaid || !mermaid.mermaidAPI) &&
         (!window.mermaid || !window.mermaid.mermaidAPI)) {
       throw new Error('Package mermaid or mermaidAPI not found.');
     }
   }
   ```

### 2. 版本冲突发现

**项目配置**：
- Cherry Markdown 版本：`0.10.3`（内置 mermaid 9.4.3）
- 项目强制使用的 mermaid 版本：`11.12.2`（通过 pnpm overrides）

**问题**：
- Cherry Markdown 0.10.3 的 mermaid 插件是为 mermaid 9.x 设计的
- Mermaid 11.x 的 API 结构发生了重大变化
- `mermaid.mermaidAPI` 在 11.x 中可能不存在或结构不同

### 3. 配置问题诊断

**用户配置** ([CherryEditor.vue:154-157](d:/develop/runlefei/CherryMarkdownDesktop/src/components/CherryEditor.vue#L154-L157))：
```typescript
onCodeBlockParse: (lang: string, code: string) => {
  console.log('解析代码块:', { lang, code: code.substring(0, 50) });
}
```

**发现**：
- `onCodeBlockParse` 回调在 Cherry Markdown 0.10.3 中**不存在**
- 这个回调永远不会被调用，导致无法调试

### 4. 运行时调试

**添加的调试代码**：

在 [CherryEditor.vue:110-147](d:/develop/runlefei/CherryMarkdownDesktop/src/components/CherryEditor.vue#L110-L147) 添加：

```typescript
// 动态导入 mermaid 和 MermaidCodeEngine
const mermaidModule = await import('mermaid');
const mermaid = mermaidModule.default || mermaidModule;

const MermaidCodeEngineModule = await import('cherry-markdown/dist/addons/cherry-code-block-mermaid-plugin.js');
const MermaidCodeEngine = MermaidCodeEngineModule.default || MermaidCodeEngineModule;

console.log('[Mermaid Debug] Cherry.usePlugin:', typeof Cherry.usePlugin);
console.log('[Mermaid Debug] MermaidCodeEngine:', typeof MermaidCodeEngine);
console.log('[Mermaid Debug] mermaid:', typeof mermaid);
```

**调试输出**：
```
[Mermaid Debug] window.mermaid: undefined
[Mermaid Debug] window.mermaid.mermaidAPI: undefined
[Mermaid Debug] window.mermaid.render: undefined
[Mermaid Debug] window.mermaid version: unknown

[Mermaid Debug] codeBlock config: undefined
[Mermaid Debug] customRenderer: undefined
[Mermaid Debug] customRenderer.mermaid: undefined
[Mermaid Debug] Mermaid custom renderer is NOT registered!
```

**关键发现**：
- `window.mermaid` 为 `undefined`
- `customRenderer.mermaid` 为 `undefined`
- Mermaid 插件**根本没有被注册**

---

## 根本原因分析

### 主要问题

**Cherry Markdown 的 npm 包没有自动加载 mermaid 插件**

虽然 Cherry Markdown 源码中的 `index.js` 会自动导入 mermaid 并注册插件：

```javascript
// 源码位置：packages/cherry-markdown/src/index.js
import MermaidCodeEngine from '@/addons/cherry-code-block-mermaid-plugin';
import mermaid from 'mermaid';

const mermaidAPI = mermaid?.mermaidAPI;
Cherry.usePlugin(MermaidCodeEngine, {
  mermaid,
  mermaidAPI,
  theme: 'default',
  sequence: { useMaxWidth: false },
});
```

但通过 npm 发布的 `cherry-markdown@0.10.3` 包中，这个自动注册过程**没有被执行**。

### 次要问题

1. **版本不兼容**：Mermaid 11.x 与 Cherry Markdown 0.10.3 的插件 API 不兼容
2. **模块解析问题**：Vite 无法直接导入 `mermaid` 模块（虽然已安装）
3. **类型声明缺失**：`mermaid` 和插件模块缺少 TypeScript 类型声明

---

## 尝试的解决方案

### 方案 1：手动导入和注册（尝试失败）

**操作**：
1. 创建类型声明文件 `src/types/mermaid.d.ts`
2. 使用动态导入加载 mermaid 和 MermaidCodeEngine
3. 在 Cherry 初始化前手动注册插件

**代码**：
```typescript
// 动态导入
const mermaidModule = await import('mermaid');
const mermaid = mermaidModule.default || mermaidModule;

const MermaidCodeEngineModule = await import('cherry-markdown/dist/addons/cherry-code-block-mermaid-plugin.js');
const MermaidCodeEngine = MermaidCodeEngineModule.default || MermaidCodeEngineModule;

// 挂载到 window
(window as any).mermaid = mermaid;

// 注册插件
Cherry.usePlugin(MermaidCodeEngine, {
  mermaid,
  mermaidAPI: mermaid.mermaidAPI || mermaid,
  theme: isDark.value ? 'dark' : 'default',
});
```

**结果**：
- 模块可以导入
- 插件可以注册
- **但 mermaid 图表仍然无法渲染**

**可能原因**：
- Mermaid 11.x API 与插件不兼容
- `mermaid.mermaidAPI` 在 11.x 中不存在
- 异步渲染逻辑问题

### 方案 2：降级到 Mermaid 9.x 或 10.x（未实施）

**建议配置**：
```json
"pnpm": {
  "overrides": {
    "mermaid": "10.9.1"
  }
}
```

**理由**：
- Cherry Markdown 0.10.3 对 mermaid 10.x 的支持可能更好
- 避免 11.x 的大规模 API 变更

**状态**：用户之前使用 9.4.3 时遇到问题，才升级到 11.x

### 方案 3：升级 Cherry Markdown（未实施）

**建议**：
检查是否有更新版本的 Cherry Markdown 支持 mermaid 11.x。

**风险**：
- 可能引入其他不兼容问题
- 需要全面测试

---

## Cherry Markdown Mermaid 处理流程

### 完整流程图

```
1. 用户输入 markdown
   ↓
2. Cherry Markdown 解析器识别 ```mermaid 代码块
   ↓
3. CodeBlock Hook 处理
   ↓
4. 检查是否为自定义语言 (this.isInternalCustomLangCovered('mermaid'))
   ↓
   ├─ 是 → 调用 customRenderer['mermaid'].render()
   │         ↓
   │      MermaidCodeEngine.render()
   │         ↓
   │      检测渲染版本 (同步/异步)
   │         ↓
   │      调用 mermaid.render(graphId, src)
   │         ↓
   │      ├─ 成功 → 返回 SVG
   │      └─ 失败 → 返回源码 (fallback)
   │
   └─ 否 → 使用 Prism.js 语法高亮
            ↓
         如果 Prism 不支持该语言 → 默认为 JavaScript
```

### 关键代码位置

| 功能 | 文件 | 行号 |
|------|------|------|
| Mermaid 插件注册 | `packages/cherry-markdown/src/addons/cherry-code-block-mermaid-plugin.js` | 62-74 |
| 版本检测 | `packages/cherry-markdown/src/addons/cherry-code-block-mermaid-plugin.js` | 139-141 |
| 同步渲染 | `packages/cherry-markdown/src/addons/cherry-code-block-mermaid-plugin.js` | 206-231 |
| 异步渲染 | `packages/cherry-markdown/src/addons/cherry-code-block-mermaid-plugin.js` | 250-286 |
| 代码块识别 | `packages/cherry-markdown/src/core/hooks/CodeBlock.js` | 458-471 |
| 自定义语言处理 | `packages/cherry-markdown/src/core/hooks/CodeBlock.js` | 123-157 |

---

## 已完成的代码修改

### 1. 移除无效的 onCodeBlockParse 回调

**文件**：`src/components/CherryEditor.vue:154-157`

**原因**：该回调在 Cherry Markdown 0.10.3 中不存在

### 2. 创建 mermaid 类型声明

**文件**：`src/types/mermaid.d.ts`

**内容**：
```typescript
declare module 'mermaid' {
  export interface MermaidConfig {
    startOnLoad?: boolean;
    theme?: string;
    logLevel?: number;
  }

  export interface MermaidAPI {
    render: (...args: any[]) => any;
    initialize: (config: MermaidConfig) => void;
  }

  const mermaid: MermaidStatic;
  export default mermaid;
}

declare module 'cherry-markdown/dist/addons/cherry-code-block-mermaid-plugin.js' {
  export default class MermaidCodeEngine {
    static TYPE: string;
    static install(cherryOptions: any, ...args: any[]): void;
    constructor(options?: any);
    render(src: string, sign: string, engine: any, props?: any): string;
  }
}
```

### 3. 添加 mermaid 插件手动注册逻辑

**文件**：`src/components/CherryEditor.vue:110-147`

**功能**：
- 动态导入 mermaid 和 MermaidCodeEngine
- 将 mermaid 挂载到 window
- 手动注册插件到 Cherry
- 添加详细的调试日志

### 4. 添加调试代码

**位置**：
- `CherryEditor.vue:110-147` - 初始化前检查
- `CherryEditor.vue:267-282` - 初始化后验证

---

## 待解决的问题

### 核心问题

**Mermaid 图表仍然无法渲染，即使插件已注册**

**可能原因**：
1. Mermaid 11.x API 与 Cherry Markdown 0.10.3 插件不兼容
2. 异步渲染逻辑在 Vue 3 环境下有问题
3. `mermaid.mermaidAPI` 在 11.x 中不存在或结构不同

### 调试建议

1. **检查 mermaid API 结构**：
   ```javascript
   console.log('mermaid keys:', Object.keys(mermaid));
   console.log('has mermaidAPI:', 'mermaidAPI' in mermaid);
   ```

2. **测试 mermaid 独立渲染**：
   ```javascript
   mermaid.render('test-id', 'graph TD\nA-->B')
     .then(result => console.log('Success:', result))
     .catch(err => console.error('Error:', err));
   ```

3. **检查 Cherry Markdown 内部配置**：
   ```javascript
   console.log('Cherry options:', cherryEditor.options);
   ```

---

## 相关文件

### Cherry Markdown 源码
- `D:\Downloads\cherry-markdown-cherry-markdown-0.10.3\packages\cherry-markdown\src\addons\cherry-code-block-mermaid-plugin.js`
- `D:\Downloads\cherry-markdown-cherry-markdown-0.10.3\packages\cherry-markdown\src\core\hooks\CodeBlock.js`
- `D:\Downloads\cherry-markdown-cherry-markdown-0.10.3\packages\cherry-markdown\src\index.js`

### 项目文件
- `d:\develop\runlefei\CherryMarkdownDesktop\src\components\CherryEditor.vue`
- `d:\develop\runlefei\CherryMarkdownDesktop\src\types\mermaid.d.ts`
- `d:\develop\runlefei\CherryMarkdownDesktop\package.json`

---

## 后续建议

### 短期方案

1. **测试 mermaid 10.9.1**：
   ```bash
   pnpm install mermaid@10.9.1
   ```

2. **检查浏览器控制台错误**：
   - 查找 mermaid 相关的 JavaScript 错误
   - 检查是否有网络资源加载失败

3. **简化测试用例**：
   - 从最简单的 mermaid 图表开始测试
   - 逐步增加复杂度，找出触发问题的临界点

### 长期方案

1. **等待 Cherry Markdown 更新**：关注是否有支持 mermaid 11.x 的新版本

2. **考虑 fork 和修改**：如果急需使用 mermaid 11.x，可以 fork cherry-markdown 插件代码进行适配

3. **替代方案**：考虑使用其他 Markdown 编辑器或自己实现 mermaid 集成

---

## 总结

这次调查深入分析了 Cherry Markdown 中 mermaid 渲染的完整流程，发现主要问题是：

1. **npm 包未自动注册插件**：Cherry Markdown 源码中有自动注册逻辑，但 npm 包中没有执行
2. **API 版本不兼容**：Mermaid 11.x 与 Cherry Markdown 0.10.3 的插件存在 API 不兼容
3. **模块加载问题**：Vite 环境下动态导入 mermaid 存在类型和模块解析问题

虽然尝试了手动注册插件的方案，但问题仍未解决。建议后续尝试降级到 mermaid 10.x 或等待 Cherry Markdown 官方支持更新版本。

---

**调查日期**：2025-01-22
**调查人**：Claude Code Assistant
**Cherry Markdown 版本**：0.10.3
**Mermaid 版本**：11.12.2
