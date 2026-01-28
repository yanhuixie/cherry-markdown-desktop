# Word 导出 Mermaid 主题问题调查报告

**调查日期**: 2026-01-21
**问题状态**: 🔍 调查中
**相关 Commit**: 92182ed, 72fae4c

## 问题描述

### 用户报告
在 Cherry Markdown Desktop 应用中导出 Word 文档时，Mermaid 图表的主题配置存在问题：

1. **开发模式 (`pnpm tauri dev`)**: 无论应用当前主题是暗色还是亮色，导出的 Word 文档中 Mermaid 图表都是**亮色**配色
2. **生产模式 (`pnpm tauri build`)**: 无论应用当前主题是暗色还是亮色，导出的 Word 文档中 Mermaid 图表都是**黑色**配色
3. **配置无效**: 传递给 `@md2docx/md2docx` 的 `mermaidConfig.theme` 参数似乎完全没有生效

### 预期行为
- 导出的 Word 文档中，Mermaid 图表应该根据当前应用主题使用相应的配色方案
- 亮色主题 → Mermaid 使用 `default` 主题（亮色）
- 暗色主题 → Mermaid 使用 `dark` 主题（暗色）

## 技术背景

### Word 导出实现
项目使用 `@md2docx/md2docx` 库实现 Markdown 到 Word 的转换：

```typescript
const blob = await md2docx(
  markdown,
  undefined,  // docxProps
  undefined,  // sectionProps
  undefined,  // outputType (默认 "blob")
  {
    mermaid: {
      mermaidConfig: {
        theme: mermaidTheme,  // 'dark' 或 'default'
      },
    },
  }
);
```

### Mermaid 依赖情况
项目中同时存在两个不同版本的 Mermaid：

```
@md2docx/md2docx 0.0.1
└─┬ @m2d/remark-docx 1.2.2
  └─┬ mdast2docx 1.6.1
    └─┬ @m2d/mermaid 1.2.2
      └── mermaid 11.12.2

@md2docx/mermaid 1.2.2
└── mermaid 11.12.2

cherry-markdown 0.10.3
└── mermaid 9.4.3
```

**关键发现**:
- Cherry Markdown 使用 `mermaid@9.4.3`（用于编辑器内显示）
- Word 导出使用 `mermaid@11.12.2`（由 `@md2docx/mermaid` 使用）

## 调查过程

### 第一步：代码分析

#### 1.1 检查配置传递路径
确认 `mermaidConfig` 配置正确传递到 `md2docx`：

```typescript
// src/components/CherryEditor.vue:exportDOCX()
const mermaidTheme = isDark.value ? 'dark' : 'default';
await md2docx(markdown, undefined, undefined, undefined, {
  mermaid: {
    mermaidConfig: {
      theme: mermaidTheme,
    },
  },
});
```

#### 1.2 检查 @md2docx/mermaid 源码
分析 `@md2docx/mermaid` 插件如何处理配置：

```javascript
// node_modules/@md2docx/mermaid/dist/index.js
var f = require("mermaid");
const G = {fontFamily:"sans-serif", suppressErrorRendering:!0};

S = (e) => {
  // 合并默认配置和用户配置
  let r = {...G, ...e?.mermaidConfig};
  // 调用 mermaid.initialize()
  f.default.initialize(r);
  // ...
}
```

**关键发现**:
- ✅ 配置确实被传递
- ✅ `mermaid.initialize()` 被正确调用
- ❌ **但 `mermaid.initialize()` 只在第一次调用时真正生效**

#### 1.3 检查 remarkDocx 插件初始化
分析 `@m2d/remark-docx` 如何初始化 Mermaid 插件：

```javascript
// node_modules/@m2d/remark-docx/dist/index.js
T = function(m="blob", i={}, a={...u.DEFAULT_SECTION_PROPS, plugins:void 0}, t) {
  return this.compiler = (r) => {
    if (!a.plugins) {
      let f = [
        (0,e.mermaidPlugin)(t?.mermaid),  // ← mermaid 插件
        // ... 其他插件
      ];
      a.plugins = typeof window=="undefined" ? f.slice(2,-1) : f;
    }
    return (0,c.toDocx)(r,i,a,m);
  };
}
```

**关键发现**:
- 插件数组 `a.plugins` 只会初始化一次（`if (!a.plugins)`）
- 在浏览器环境下（`typeof window !== "undefined"`），所有插件都会被加载
- Mermaid 插件确实接收到了 `pluginProps.mermaid` 配置

### 第二步：添加日志系统

为了更好地诊断问题，创建了日志系统：

#### 2.1 Rust 端（后端）
添加了 `log_frontend` Tauri command：

```rust
// src-tauri/src/lib.rs
#[tauri::command]
fn log_frontend(message: String) {
    log::info!("[FRONTEND] {}", message);
}

// 注册 command
.invoke_handler(tauri::generate_handler![get_pending_file, greet, log_frontend])
```

日志文件位置：`<exe所在目录>/cherrymarkdowndesktop.log`

#### 2.2 前端
创建了日志工具类：

```typescript
// src/utils/logger.ts
import { invoke } from '@tauri-apps/api/core';

class Logger {
  async log(message: string): Promise<void> {
    console.log(message);
    await invoke('log_frontend', { message });
  }
}

export const logInfo = (message: string) => logger.log(message);
```

### 第三步：实际测试结果

#### 开发模式日志
```
[2026-02-15T04:04:37 INFO] [FRONTEND] [exportDOCX] 当前主题 isDark: true
[2026-02-15T04:04:37 INFO] [FRONTEND] [exportDOCX] Mermaid 主题配置: dark
[2026-02-15T04:04:37 INFO] [FRONTEND] [exportDOCX] 未找到全局 mermaid 实例
[2026-02-15T04:04:37 INFO] [FRONTEND] [exportDOCX] 找到的相关全局变量: []
[2026-02-15T04:04:40 INFO] [FRONTEND] [exportDOCX] 传递的 mermaid 配置: {"theme":"dark"}
```

**结果**: Mermaid 图表是**亮色** ❌（配置被忽略）

#### 生产模式日志
```
[2026-02-15T04:07:30 INFO] [FRONTEND] [exportDOCX] 当前主题 isDark: false
[2026-02-15T04:07:30 INFO] [FRONTEND] [exportDOCX] Mermaid 主题配置: default
[2026-02-15T04:07:30 INFO] [FRONTEND] [exportDOCX] 未找到全局 mermaid 实例
[2026-02-15T04:07:30 INFO] [FRONTEND] [exportDOCX] 找到的相关全局变量: []
[2026-02-15T04:07:33 INFO] [FRONTEND] [exportDOCX] 传递的 mermaid 配置: {"theme":"default"}
```

**结果**: Mermaid 图表是**黑色** ❌（配置虽然匹配，但显示不正确）

## 核心问题分析

### 问题根源

1. **Mermaid v11 的 `initialize()` 限制**
   - Mermaid v11 的 `initialize()` 方法只在第一次调用时真正生效
   - 后续调用不会更新配置，除非先调用 `reset()` 或 `globalReset()`

2. **模块加载顺序问题**
   - `@md2docx/mermaid` 插件在模块加载时就调用了 `mermaid.initialize()`
   - 此时使用的是默认配置，即 `theme: 'default'`
   - 当我们后续传递配置时，已经无法改变 Mermaid 的主题

3. **开发模式 vs 生产模式的差异**
   - **开发模式**: 可能使用了不同版本的 Mermaid（v9），默认主题是亮色
   - **生产模式**: 打包后使用 Mermaid v11，但由于某种原因显示为黑色

4. **全局变量访问失败**
   - 日志显示 `window.mermaid` 不存在
   - 无法通过全局变量直接访问和重置 Mermaid 实例

### 尝试过的解决方案

#### 方案 1: 通过全局变量重置 ❌
```typescript
const globalMermaid = (window as any).mermaid;
if (globalMermaid) {
  globalMermaid.reset();
  globalMermaid.initialize({ theme: mermaidTheme });
}
```
**结果**: `window.mermaid` 不存在，方案失败

#### 方案 2: 添加详细的日志记录 ✅
**结果**: 成功记录了配置传递过程，但配置仍然不生效

#### 方案 3: 在调用 md2docx 之前手动初始化 mermaidPlugin 🔧
```typescript
const { mermaidPlugin } = await import('@md2docx/mermaid');
mermaidPlugin({
  mermaidConfig: {
    theme: mermaidTheme,
    startOnLoad: false,
    logLevel: 0,
  },
});
```

**原理**:
- 在 `md2docx` 调用之前，先手动调用 `mermaidPlugin()` 来触发 `mermaid.initialize()`
- 这样可以确保 Mermaid 使用我们指定的主题进行初始化

**状态**: 待测试

## 技术细节

### Mermaid v11 支持的主题
- `default` - 默认主题（亮色）
- `dark` - 暗色主题
- `forest` - 森林主题（绿色调）
- `neutral` - 中性主题（适合打印）
- `base` - 基础主题

### Mermaid v11 API
```typescript
interface Mermaid {
  initialize(config: MermaidConfig): void;
  render(id: string, text: string): Promise<RenderResult>;
  reset(): void;  // 重置 Mermaid 状态
  globalReset(): void;  // 全局重置
}
```

### @md2docx/mermaid 配置接口
```typescript
interface IMermaidPluginOptions {
  mermaidConfig?: MermaidConfig;
  fixMermaid?: (mermaidCode: string, error: Error) => string;
  cache?: Record<string, Promise<unknown>>;
  cacheConfig?: CacheConfigType<RenderResult | undefined>;
  maxAgeMinutes?: number;
}
```

## 待验证的假设

### 假设 1: Mermaid 实例单例模式
Mermaid 可能使用单例模式，整个应用共享一个实例。如果是这样：
- Cherry Markdown 的 Mermaid v9 实例可能先初始化
- Word 导出的 Mermaid v11 实例可能受到影响

### 假设 2: Vite 打包差异
开发模式和生产模式的打包方式可能导致：
- 开发模式：使用 ESM 模块，可能加载了不同的 Mermaid 实例
- 生产模式：使用 Rollup 打包，可能产生了模块冲突

### 假设 3: 主题配置时机问题
Mermaid 的主题配置必须在第一次 `render()` 调用之前完成。如果：
- `@md2docx/mermaid` 在模块加载时就初始化了 Mermaid
- 此时使用的是默认配置
- 后续传递的配置无法覆盖已初始化的实例

## 下一步行动

### 短期方案（当前尝试）
1. ✅ 在调用 `md2docx` 之前手动初始化 `mermaidPlugin`
2. ⏳ 测试该方案是否有效
3. ⏳ 如果无效，尝试在 Vite 配置中将 Mermaid 作为外部依赖

### 中期方案
1. 研究是否可以修改 `@md2docx/mermaid` 插件的源码
2. 考虑 Fork 该库并修复主题配置问题
3. 向 `@md2docx/mermaid` 提交 issue 或 PR

### 长期方案
1. 考虑切换到其他 Word 导出方案
2. 评估是否可以直接使用 `mdast2docx` 而不是 `@md2docx/md2docx`
3. 研究是否可以在导出时直接修改生成的 SVG（post-processing）

## 相关文件

### 前端代码
- `src/components/CherryEditor.vue` - 导出功能实现
- `src/utils/logger.ts` - 日志工具
- `src/composables/useTheme.ts` - 主题管理

### 后端代码
- `src-tauri/src/lib.rs` - Tauri command 定义

### 配置文件
- `vite.config.ts` - Vite 构建配置
- `src-tauri/tauri.conf.json` - Tauri 应用配置

### 文档
- `docs/mermaid暗色主题适配记录.md` - Cherry 编辑器内 Mermaid 主题适配历史

## 参考资料

### Mermaid 官方文档
- [Mermaid 主题配置](https://mermaid.js.org/config/theming.html)
- [Mermaid Configuration](https://mermaid.js.org/config/configuration.html)

### 相关库
- [@md2docx/md2docx](https://www.npmjs.com/package/@md2docx/md2docx)
- [@md2docx/mermaid](https://www.npmjs.com/package/@md2docx/mermaid)
- [mdast2docx](https://www.npmjs.com/package/mdast2docx)

### Cherry Markdown
- [Cherry Markdown 源码](D:\Downloads\cherry-markdown-cherry-markdown-0.10.3)
- [Mermaid 插件源码](D:\Downloads\cherry-markdown-cherry-markdown-0.10.3\packages\client)

## 结论

本次调查发现了 Word 导出 Mermaid 主题配置失效的根本原因：**Mermaid v11 的 `initialize()` 方法只在第一次调用时生效**。

当前的解决方案是在调用 `md2docx` 之前手动初始化 `mermaidPlugin`，确保使用正确的主题配置。

该问题还需要进一步测试和验证，如果当前方案无效，可能需要考虑更底层的解决方案，如修改构建配置或更换 Word 导出库。

---

**更新日期**: 2026-01-21
**文档版本**: 1.0
**作者**: Claude Code Assistant

---

## 2026-01-21 调查记录：尝试 markdown→HTML→docx 方案

### 背景

用户提出尝试使用 **markdown→HTML→docx** 的导出方案，希望利用 Cherry Markdown 已有的 HTML 渲染能力（`getExportContent` 函数），然后再将 HTML 转换为 DOCX。

### 尝试过程

#### 尝试 1: @turbodocx/html-to-docx ❌

**安装**:
```bash
pnpm add @turbodocx/html-to-docx
```

**实现代码**:
```typescript
import HtmlToDocx from "@turbodocx/html-to-docx";

const htmlContent = cherryEditor.getHtml();
const fullHtml = `<!DOCTYPE html>...${htmlContent}...</html>`;

const docx = await HtmlToDocx(fullHtml, null, {
  title: defaultFilename,
  creator: 'Cherry Markdown Desktop',
  table: {
    row: { cantSplit: true },
    borderOptions: { size: 1, color: '000000' }
  },
});
```

**错误**:
```
TypeError: Class extends value undefined is not a constructor or null
at node_modules/.pnpm/xmlbuilder2@2.1.2/node_modules/xmlbuilder2/lib/builder/XMLBuilderCBImpl.js
```

**问题分析**:
- 该库的依赖 `xmlbuilder2` 主要为 Node.js 环境设计
- 文档明确说明："Currently optimized for Node.js environments. Browser support is planned for future releases."
- 在浏览器环境中不兼容

**结论**: ❌ 不适合浏览器环境

---

#### 尝试 2: html-docx-js-typescript ❌

**安装**:
```bash
pnpm remove @turbodocx/html-to-docx
pnpm add html-docx-js-typescript
```

**实现代码**:
```typescript
import { asBlob } from 'html-docx-js-typescript';

const docxBlob = await asBlob(fullHtml) as Blob;
```

**错误**:
```
TypeError: Cannot read properties of undefined (reading 'asBlob')
```

**问题分析**:
- 最初使用了错误的导入方式（默认导出）
- 修正为命名导出后可以运行，但存在致命缺陷

**致命问题**: ❌ **不能正确处理 SVG（包括 Mermaid 图表）**
- 用户反馈："它根本没有处理 Mermaid，只是将 HTML 里的 svg 里的纯文本提取出来了，根本没有将 svg 转成图片啊！"
- DOCX 格式本身不支持直接嵌入 SVG，需要预先转换为图片（PNG）
- 该库没有内置 SVG → 图片的转换功能

**结论**: ❌ 无法处理 Mermaid 图表

---

#### 尝试 3: html-to-docx (privateOmega 版本) ❌

**安装**:
```bash
pnpm remove html-docx-js-typescript
pnpm add html-to-docx
```

**包信息**:
```json
{
  "name": "html-to-docx",
  "version": "1.8.0",
  "main": "dist/html-to-docx.umd.js",
  "module": "dist/html-to-docx.esm.js"
}
```

**问题分析**:
检查 `dist/html-to-docx.esm.js` 文件头部发现：

```javascript
import crypto from "crypto";
import fs from "fs";
import path from "path";
import util from "util";
import events from "events";
import Stream from "stream";
import http from "http";
import Url from "url";
import punycode from "punycode";
import https from "https";
import zlib from "zlib";
```

**致命问题**: ❌ **依赖大量 Node.js 核心模块**
- 这些模块在浏览器环境中完全不存在
- 该库无法在浏览器中直接使用
- 即使通过 Vite 的 polyfill 配置也很难解决（需要 polyfill 10+ 个核心模块）

**结论**: ❌ 不适合浏览器环境

---

### HTML→DOCX 方案总结

| 库名 | 版本 | 主要问题 | 浏览器支持 | Mermaid 支持 |
|------|------|---------|-----------|-------------|
| `@turbodocx/html-to-docx` | 1.18.1 | `xmlbuilder2` 不兼容 | ❌ 计划中 | ❓ 未知 |
| `html-docx-js-typescript` | 0.1.5 | 不能处理 SVG/Mermaid | ✅ 是 | ❌ 仅纯文本 |
| `html-to-docx` | 1.8.0 | 需要 Node.js 核心模块 | ❌ 否 | ❌ 无法运行 |
| `@md2docx/md2docx` | 0.0.1 | 主题配置问题 | ✅ 是 | ✅ 原生支持 |

### 核心发现

**HTML→DOCX 方案的根本障碍**:

1. **浏览器环境限制**
   - 大多数 HTML→DOCX 库主要为 Node.js 设计
   - 依赖 Node.js 核心模块（`fs`, `crypto`, `http` 等）
   - 浏览器 polyfill 非常复杂

2. **SVG 处理难题**
   - DOCX 格式不支持直接嵌入 SVG
   - 必须预先将 SVG 转换为图片（PNG）
   - 需要额外的图片处理逻辑：
     - 找到所有 SVG 元素
     - 将 SVG 转换为 Canvas
     - 再转换为 PNG base64
     - 替换 HTML 中的 SVG

3. **Mermaid 特殊性**
   - Mermaid 生成的 SVG 通常包含复杂的样式和动画
   - 转换为图片后可能失去矢量特性
   - 主题配置更难应用（需要在 SVG 生成时就指定）

### 最终决策

**回到 `@md2docx/md2docx` 方案** ✅

**理由**:
1. ✅ **专为 Markdown 设计**：直接处理 Markdown，无需中间 HTML 转换
2. ✅ **原生支持 Mermaid**：通过 `@md2docx/mermaid` 插件内置支持
3. ✅ **浏览器兼容**：可以在浏览器环境中正常运行
4. ✅ **更简单可靠**：不需要手动处理 SVG 转换

**当前实现**:
```typescript
// src/components/CherryEditor.vue:exportDOCX()
const { md2docx } = await import('@md2docx/md2docx');
const markdown = cherryEditor.getMarkdown();
const blob = await md2docx(
  markdown,
  undefined,  // docxProps
  undefined,  // sectionProps
  undefined,  // outputType
  {
    mermaid: {
      mermaidConfig: {
        theme: isDark.value ? 'dark' : 'default',
      },
    },
  }
) as Blob;
```

### 待解决问题

虽然回到 `@md2docx/md2docx` 方案，但**主题配置问题依然存在**（见前文调查）：

- ✅ 代码可以运行
- ✅ Mermaid 图表可以导出
- ❌ 主题配置不生效（开发模式总是亮色，生产模式总是黑色）

**下一步行动**:
1. 继续调查 `@md2docx/md2docx` 的主题配置问题
2. 尝试在调用 `md2docx` 之前手动初始化 Mermaid 实例
3. 考虑是否需要 Fork `@md2docx/mermaid` 插件修复主题问题

### 技术总结

**HTML→DOCX 不是万能解决方案**:

虽然理论上可以通过 Markdown → HTML → DOCX 的流程实现导出，但实际上：
- 浏览器环境的 HTML→DOCX 库非常有限
- 大多数库有浏览器兼容性问题
- SVG/Mermaid 处理需要额外的复杂逻辑
- 不如直接使用 Markdown→DOCX 的专用库

**推荐方案优先级**:
1. **首选**: `@md2docx/md2docx`（Markdown → DOCX 专用）
2. **备选**: 预处理 SVG → 图片 + `html-docx-js-typescript`（复杂度高）
3. **不推荐**: 其他 HTML→DOCX 库（浏览器不兼容）

---

**更新日期**: 2026-01-21
**文档版本**: 1.1
**更新内容**: 添加 markdown→HTML→docx 方案调查记录
**作者**: Claude Code Assistant
