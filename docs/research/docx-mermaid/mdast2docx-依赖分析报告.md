# mdast2docx 依赖分析报告

**日期**: 2025-01-27
**目标**: 分析 mdast2docx 及其所有依赖的源码结构，为集成到项目做准备

## 1. 依赖关系图

```
mdast2docx (1.6.1)
├── @m2d/core (1.7.1) - 核心库
│   └── docx (9.5.1)
├── @m2d/emoji (0.1.3) - Emoji 支持
├── @m2d/html (1.1.11) - HTML 转换
├── @m2d/image (1.4.1) - 图片处理 ⭐
│   ├── @m2d/core (1.7.0)
│   ├── @svg-fns/io (1.0.0) - SVG 解析
│   └── @svg-fns/svg2img (0.0.0) - SVG → PNG ⭐⭐
├── @m2d/list (0.0.9) - 列表转换
├── @m2d/math (0.0.6) - 数学公式
├── @m2d/mermaid (1.2.2) - Mermaid 图表 ⭐
├── @m2d/table (0.1.1) - 表格转换
└── docx (9.5.1) - DOCX 生成库
```

**关键问题点**：标记 ⭐ 的包是 Mermaid 导出失败的核心环节

## 2. 各包源码结构分析

### 2.1 @m2d/core (核心库)

**位置**: `node_modules/.pnpm/@m2d+core@1.7.1_docx@9.5.1/node_modules/@m2d/core/`

**源码文件**:
```
dist/
├── index.js          - 主入口，导出 toDocx 函数
├── index.mjs
├── index.d.ts
├── section.js        - Section 处理
├── section.mjs
├── section.d.ts
└── utils/            - 工具函数
    ├── index.js
    ├── index.mjs
    └── index.d.ts
```

**关键类型定义**:
```typescript
type IInputMDAST = Root | {
    ast: Root;
    props?: ISectionProps;
}[];

declare const toDocx: (
    astInputs: IInputMDAST,
    docxProps?: IDocxProps,
    defaultSectionProps?: ISectionProps,
    outputType?: OutputType
) => Promise<Blob | ArrayBuffer | string>;
```

**依赖**: 仅依赖 `docx` 库

### 2.2 @m2d/image (图片处理) ⭐ **核心问题**

**位置**: `node_modules/.pnpm/@m2d+image@1.4.1_docx@9.5.1/node_modules/@m2d/image/`

**源码文件**:
```
dist/
├── index.js          - 主入口
├── index.mjs
├── index.d.ts
├── svg-utils.js      - SVG 处理工具 ⭐⭐
├── svg-utils.mjs
├── svg-utils.d.ts
├── utils.js
├── utils.mjs
├── utils.d.ts
├── types.js
├── types.mjs
└── types.d.ts
└── chunk-*.mjs       - 动态导入的代码块
```

**关键函数** (svg-utils.js):

```javascript
const handleSvg = async (node, options) => {
    // 1. 获取 SVG 字符串
    let svgContent = node.value;

    // 2. 修复 SVG 问题（针对 Mermaid）
    svgContent = fixGeneratedSvg(svgContent, options);

    // 3. 解析 SVG 尺寸（可选，使用 DOM）
    const { svg, scale } = await parseSvgSize(svgContent, options);

    // 4. ⭐ 调用 @svg-fns/svg2img.svgToBlob 转换
    const { blob, width, height } = await svgToBlob(svg, {
        format: options.fallbackImageType,
        scale: options.scale,
        quality: options.quality
    });

    // 5. 返回图片数据
    return {
        type: options.fallbackImageType,
        data: await blob.arrayBuffer(),
        transformation: { width: width * scale, height: height * scale }
    };
};
```

**依赖**:
- `@m2d/core` - 插件系统
- `@svg-fns/io` - SVG 解析（parseSvg）
- `@svg-fns/svg2img` - SVG → Blob 转换

**问题点**:
- 第 4 步调用 `svgToBlob` 时，对大型 SVG 会失败

### 2.3 @svg-fns/svg2img (SVG 转图片) ⭐⭐ **根本原因**

**位置**: `node_modules/.pnpm/@svg-fns+svg2img@0.0.0/node_modules/@svg-fns/svg2img/`

**源码文件**:
```
dist/
├── index.js          - 主入口，导出 svgToBlob
├── index.mjs
├── index.d.ts
├── server.js         - 服务端版本（使用 sharp）
├── server.mjs
├── server.d.ts
└── chunk-*.mjs       - 工具函数
```

**关键函数** (index.js):

```javascript
const svgToBlob = async (svgString, options) => {
    const { format, quality, scale, background, fit } = normalizeOptions(options);

    // 1. 将 SVG 转换为 Blob
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });

    // 2. 转换为 Data URL
    const dataUrl = await blobToDataURLBrowser(svgBlob);

    // 3. ⭐ 使用 Image 对象加载（失败点）
    const img = new Image();
    img.src = dataUrl;  // 45KB+ SVG 的 Data URL 无法加载
    await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;  // ❌ 大型 SVG 在这里 rejected
    });

    // 4. 解析尺寸
    const { width, height } = resolveDimensions(options, img);

    // 5. 创建 Canvas
    const canvas = new OffscreenCanvas(width * scale, height * scale);
    const ctx = canvas.getContext('2d');

    // 6. 绘制并转换为 Blob
    ctx.drawImage(img, 0, 0, width, height);
    const pngBlob = await canvas.convertToBlob({ type: `image/${format}`, quality });

    return { blob: pngBlob, width, height, format, scale };
};
```

**依赖**:
- 无运行时依赖（peer dependency: sharp 可选）

**根本问题**:
- 第 3 步的 `new Image().src = dataUrl` 对大型 SVG（45KB+）会失败
- 这是浏览器的图像解码器限制，无法绕过

### 2.4 @m2d/mermaid (Mermaid 图表) ⭐

**位置**: `node_modules/.pnpm/@m2d+mermaid@1.2.2_docx@9.5.1/node_modules/@m2d/mermaid/`

**源码文件**:
```
dist/
├── index.js
├── index.mjs
└── index.d.ts
```

**功能**:
- 将 Mermaid 代码块转换为 SVG
- 传递给 @m2d/image 处理

**依赖**:
- `@m2d/core`
- `mermaid` (11.x)

### 2.5 @svg-fns/io (SVG 解析)

**位置**: `node_modules/.pnpm/@svg-fns+io@1.0.1/node_modules/@svg-fns/io/`

**源码文件**:
```
dist/
├── index.js
├── index.mjs
└── index.d.ts
```

**功能**:
- `parseSvg()` - 将 SVG 字符串解析为 DOM 元素
- 获取 SVG 的 `getBBox()` 尺寸

**依赖**: 无

### 2.6 其他 @m2d 包

#### @m2d/html (HTML 转换)
- 处理内联 HTML 标签（如 `<strong>`, `<em>` 等）
- 依赖: `@m2d/core`

#### @m2d/list (列表转换)
- 处理有序列表和无序列表
- 依赖: `@m2d/core`

#### @m2d/math (数学公式)
- 处理 LaTeX 数学公式
- 依赖: `@m2d/core`

#### @m2d/table (表格转换)
- 处理 Markdown 表格
- 依赖: `@m2d/core`

#### @m2d/emoji (Emoji 支持)
- 处理 Emoji 表情符号
- 依赖: `@m2d/core`

## 3. 集成方案

### 方案 A: 完全集成（推荐）

**目标目录结构**:
```
src/utils/mdast2docx/
├── core/                   # @m2d/core
│   ├── index.ts
│   ├── section.ts
│   └── utils.ts
├── emoji/                  # @m2d/emoji
│   └── index.ts
├── html/                   # @m2d/html
│   └── index.ts
├── image/                  # @m2d/image ⭐
│   ├── index.ts
│   ├── svg-utils.ts        # 关键修改点
│   └── utils.ts
├── list/                   # @m2d/list
│   └── index.ts
├── math/                   # @m2d/math
│   └── index.ts
├── mermaid/                # @m2d/mermaid ⭐
│   └── index.ts
├── table/                  # @m2d/table
│   └── index.ts
├── svg-fns/                # @svg-fns 系列包
│   ├── io/                 # @svg-fns/io
│   │   └── index.ts
│   └── svg2img/            # @svg-fns/svg2img ⭐⭐
│       ├── index.ts        # 客户端版本
│       ├── server.ts       # 服务端版本
│       └── utils.ts
└── index.ts                # 统一导出
```

**优势**:
1. 完全控制源代码，可以自由修改
2. 不受 npm 包版本限制
3. 可以针对性地修改 `svg-utils.ts` 和 `svg2img/index.ts`
4. 便于调试和优化

**劣势**:
1. 需要手动维护这些代码
2. npm 包更新时需要手动同步
3. 项目体积增加（约 200KB 源码）

### 方案 B: 部分集成（仅核心问题包）

**仅集成**:
- `@m2d/image`
- `@m2d/mermaid`
- `@svg-fns/svg2img`
- `@svg-fns/io`

**其他包继续使用 npm 包**:
- `@m2d/core`
- `@m2d/html`
- `@m2d/list`
- `@m2d/math`
- `@m2d/table`
- `@m2d/emoji`

**优势**:
1. 减少维护成本
2. 只修改核心问题部分
3. 其他包继续享受 npm 更新

**劣势**:
1. npm 包更新可能导致接口不兼容
2. 需要确保版本兼容性

### 方案 C: 使用 pnpm patch（临时方案）

使用 pnpm 的 patch 功能修改 node_modules 中的包：

```bash
# 修改源码后
pnpm patch @m2d/image@1.4.1
pnpm patch @svg-fns/svg2img@0.0.0
```

**优势**:
1. 不需要复制源码
2. 修改自动应用到 node_modules
3. 可以提交 patch 文件到版本控制

**劣势**:
1. patch 文件可能难以维护
2. 升级包版本时需要重新 patch
3. 不利于深度定制

## 4. 推荐方案

**我推荐方案 A（完全集成）**，理由如下：

1. **长期维护性**: 你已经尝试了 6 种方案，问题根源在 `svgToBlob` 的实现。完全集成可以让你：
   - 添加 Worker 版本的 `svgToBlob`
   - 添加 Cherry 预览缓存支持
   - 添加多种回退方案（canvg, html2canvas 等）

2. **灵活修改**: 可以直接在源码中添加功能，而不受限于第三方包的接口

3. **调试方便**: 可以添加详细的日志和错误处理

4. **独立性**: 不依赖 npm 包的更新节奏

## 5. 实施步骤

### 步骤 1: 提取源码（从 node_modules）

```bash
# 创建目标目录
mkdir -p src/utils/mdast2docx

# 复制所有 @m2d 包
cp -r node_modules/.pnpm/@m2d+core@1.7.1_docx@9.5.1/node_modules/@m2d/core/src \
      src/utils/mdast2docx/core
cp -r node_modules/.pnpm/@m2d+image@1.4.1_docx@9.5.1/node_modules/@m2d/image/src \
      src/utils/mdast2docx/image
# ... 其他包

# 复制 @svg-fns 包
cp -r node_modules/.pnpm/@svg-fns+io@1.0.1/node_modules/@svg-fns/io/src \
      src/utils/mdast2docx/svg-fns/io
cp -r node_modules/.pnpm/@svg-fns+svg2img@0.0.0/node_modules/@svg-fns/svg2img/src \
      src/utils/mdast2docx/svg-fns/svg2img
```

### 步骤 2: 转换为 TypeScript

由于这些包都是 TypeScript 编写的，dist 目录中的是编译后的 JS。我们需要：

1. 从 GitHub 获取原始源码
2. 或者反编译 dist 中的 JS（不推荐）
3. 或者直接使用 dist 中的 JS 并添加类型声明

**推荐**: 从 GitHub 获取原始源码

### 步骤 3: 修改核心问题代码

#### 3.1 修改 `svg-fns/svg2img/index.ts`

添加 Worker 版本的 `svgToBlob`:

```typescript
// 新增 Worker 版本
export const svgToBlobWorker = async (
    svg: string,
    options: SvgToBlobOptions
): Promise<SvgToBlobResult> => {
    // 使用 OffscreenCanvas + createImageBitmap
    // 避免使用 new Image()
};
```

#### 3.2 修改 `image/svg-utils.ts`

添加 Cherry 缓存支持:

```typescript
const handleSvg = async (node, options) => {
    // 优先使用 Cherry 预览缓存的 PNG
    if (options.renderedPngCache) {
        const cached = options.renderedPngCache.get(node.index);
        if (cached) {
            return { /* ... PNG 数据 ... */ };
        }
    }

    // 回退到 SVG 渲染
    // 使用 Worker 版本的 svgToBlob
};
```

### 步骤 4: 更新 package.json

移除 @m2d 系列包的依赖（但保留 docx 和 mermaid）:

```json
{
    "dependencies": {
        "docx": "^9.5.1",
        "mermaid": "11.12.2",
        // 移除所有 @m2d/* 和 @svg-fns/*
    }
}
```

### 步骤 5: 更新导入路径

```typescript
// 旧
import { toDocx } from 'mdast2docx';

// 新
import { toDocx } from '@/utils/mdast2docx';
```

## 6. 风险与注意事项

### 风险 1: 源码获取难度

- 这些包的源码在 GitHub 上的 monorepo 中
- 可能需要手动提取
- 或者使用反编译工具

### 风险 2: 版本同步

- 原包更新时需要手动同步
- 可能错过 bug 修复和新功能

### 风险 3: 类型兼容性

- 提取的源码可能缺少类型定义
- 需要手动编写 .d.ts 文件

### 风险 4: 构建配置

- 可能需要修改 Vite 配置
- 处理 Worker 文件的导入
- 确保依赖正确打包

## 7. 替代方案

如果上述方案过于复杂，可以考虑：

### 方案 D: Fork GitHub 仓库

1. Fork md2docx 组织下的所有仓库
2. 修改源码并发布到私有 npm
3. 在 package.json 中使用私有包

**优势**:
- 保持 npm 包的形式
- 可以使用 pnpm 的 workspace 功能

**劣势**:
- 需要维护多个仓库
- 发布流程复杂

### 方案 E: 使用 canvg 替代 svg2img

保留 mdast2docx，但修改 @m2d/image 使用 canvg:

```typescript
import { fromSvg } from 'canvg';

const handleSvg = async (node, options) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const v = await fromSvg(ctx, svgString);
    await v.render();

    const pngBlob = await canvas.toBlob('image/png');
    // ...
};
```

**优势**:
- canvg 使用自己的 SVG 渲染引擎
- 不依赖浏览器图像解码器
- 可以处理复杂 SVG

**劣势**:
- 需要额外的库（约 500KB）
- 性能可能不如原生实现

## 8. 下一步行动

### 建议

**根据你的需求，我建议先尝试方案 E（canvg）**：

1. **风险最低**: 不需要提取大量源码
2. **实现简单**: 只需修改 `handleSvg` 函数
3. **效果最好**: canvg 是成熟的解决方案

**如果 canvg 仍然无法解决问题，再考虑方案 A（完全集成）**。

### 需要你的决策

请告诉我你想采用哪个方案：

1. **方案 A**: 完全集成（需要提取所有源码）
2. **方案 B**: 部分集成（仅核心问题包）
3. **方案 E**: 使用 canvg 替代 svg2img
4. **其他**: 你有更好的想法

---

**文档版本**: 1.0
**最后更新**: 2025-01-27
**作者**: Claude Code
