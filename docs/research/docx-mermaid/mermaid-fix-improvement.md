# Mermaid 导出修复 - 改进版本

**日期**: 2025-01-27
**状态**: ✅ 改进完成，待验证
**改进内容**: Promise 检测逻辑优化

---

## 改进内容

### 1. 更精确的 Promise 检测

**文件**: `src/utils/mdast2docx/image/src/index.ts:326-332`

#### 改进前
```typescript
if ((node as SVG).value && typeof (node as SVG).value === 'object') {
  console.log('[imagePlugin/preprocess] Skipping SVG node with Promise data');
  return;
}
```

**问题**：
- 将所有对象都当作 Promise（不够精确）
- 可能误判普通对象为 Promise

#### 改进后
```typescript
// *** 关键修复：如果 value 是 Promise（来自 mermaid plugin 的异步渲染），跳过处理 ***
// 检查是否为 Promise 的方法：1. instanceof Promise（不可靠，需兼容跨realm） 2. typeof value.then === 'function'
const svgValue = (node as SVG).value;
if (svgValue && typeof svgValue === 'object' && typeof (svgValue as Promise<unknown>).then === 'function') {
  console.log('[imagePlugin/preprocess] Detected SVG node with Promise value (async rendering), skipping to let mermaid plugin complete first');
  return; // 让 mermaid plugin 的 async 处理完成
}
```

**改进点**：
1. 使用 `then` 方法检测（遵循 Promise/Thenable 规范）
2. 更准确地识别 Promise 对象
3. 避免误判普通对象
4. 增加了更清晰的日志说明

---

## 技术原理

### Promise 检测方法对比

| 方法 | 优点 | 缺点 |
|------|------|------|
| `value instanceof Promise` | 直观 | 跨 realm 不可靠（如 iframe、Web Worker） |
| `typeof value.then === 'function'` | 遵循 Thenable 规范，兼容性好 | 需要额外检查类型确保是对象 |
| `Object.prototype.toString.call(value) === '[object Promise]'` | 最准确 | 性能略差，代码冗长 |

**我们选择的方法**：`typeof value.then === 'function'`
- ✅ 兼容性好（遵循 Promise/A+ 规范）
- ✅ 跨 realm 可靠
- ✅ 性能好
- ✅ 代码简洁

### 检测逻辑

```typescript
// 三重检查确保准确性：
1. svgValue &&              // 不是 null/undefined
2. typeof svgValue === 'object' &&  // 是对象（排除字符串、数字等）
3. typeof (svgValue as Promise<unknown>).then === 'function'  // 有 then 方法（Promise 特征）
```

---

## 验证步骤

### 1. 构建项目
```bash
pnpm build
```

### 2. 启动开发模式
```bash
pnpm tauri dev
```

### 3. 测试用例

创建包含以下 Mermaid 图表的 Markdown 文件：

```markdown
# Mermaid 测试

## 简单图表
\`\`\`mermaid
graph TD
    A[开始] --> B[结束]
\`\`\`

## 复杂图表 1
\`\`\`mermaid
flowchart TD
    A[开始] --> B{判断}
    B -->|是| C[路径1]
    B -->|否| D[路径2]
    C --> E[结束]
    D --> E
\`\`\`

## 复杂图表 2
\`\`\`mermaid
pie title 数据分布
    "类别A" : 30
    "类别B" : 50
    "类别C" : 20
\`\`\`
```

### 4. 导出为 DOCX 并检查

**控制台应该显示**：
```
[imagePlugin/preprocess] Processing node: { type: 'svg', ... }
[imagePlugin/preprocess] Detected SVG node with Promise value (async rendering), skipping to let mermaid plugin complete first
[md2docx] Processing mermaid diagram (ID: mxxx)
[md2docx] Mermaid render succeeded
[handleSvg] Conversion completed. Blob size: XXXXXX
[imagePlugin] Creating ImageRun with data: { type: 'png', dataSize: XXXXXX, ... }
```

**DOCX 文件中应该**：
- ✅ 所有三个图表都正常显示
- ✅ 没有占位符
- ✅ 图像清晰，无失真

---

## 已完成的所有修复

| 修复项 | 文件 | 状态 |
|--------|------|------|
| 插件支持 | CherryEditor.vue | ✅ |
| CORS 问题 | svg-fns/svg2img/client.ts | ✅ |
| Promise 跳过（初版） | image/src/index.ts | ✅ |
| Promise 跳过（改进版） | image/src/index.ts | ✅ |
| Mermaid 改进 | mermaid/src/index.ts | ✅ |

---

## 后续建议

### 1. 错误处理增强
如果 Mermaid 渲染失败（返回 `undefined`），应该：
- 记录详细的错误信息
- 可选：使用占位符或错误提示图片
- 在 DOCX 中添加错误说明

### 2. 性能优化
- 考虑缓存已渲染的 SVG
- 大型图表可能需要超时控制

### 3. 用户体验
- 在导出时显示进度提示
- 对于渲染失败的图表，提供明确的错误信息

---

## 相关文档

- [Mermaid 导出调查报告](./mermaid-export-investigation.md)
- [mdast2docx 集成总结](./mdast2docx-集成总结.md)

---

---

## 最终修正：等待 Promise 并继续处理（✅ 成功）

**日期**: 2025-01-27
**状态**: ✅ **验证通过 - 三个图表全部正常显示**

### 问题发现

在上一版改进后，虽然 Promise 检测更精确了，但出现了新的问题：

**现象**：
- 所有 Mermaid 图表都消失了（连占位符都没有）
- 控制台警告：`[imagePlugin] ⚠️ Skipping inline rendering - invalid image data: {hasData: true, hasType: false, hasTransformation: false}`

**原因分析**：
```typescript
// 上一版的代码（有问题）
if (svgValue && typeof svgValue === 'object' && typeof (svgValue as Promise<unknown>).then === 'function') {
  console.log('[imagePlugin/preprocess] Detected SVG node with Promise value');
  return;  // ❌ 直接跳过，导致 node.data 从未被设置！
}
```

**问题根源**：
1. imagePlugin 检测到 Promise 后直接 `return` 跳过
2. Mermaid plugin 的 Promise resolve 后，**没有设置 `node.data`**（只设置了 `node.value`）
3. imagePlugin 的 `inline` 阶段检查时，发现 `node.data` 缺少 `type` 和 `transformation`
4. 防御性检查生效，跳过了渲染

### 最终解决方案

**核心思路**：检测到 Promise 时，**不要跳过，而是等待它完成，然后继续处理**！

**文件**: `src/utils/mdast2docx/image/src/index.ts:326-350`

```typescript
// *** 关键修复：如果 value 是 Promise（来自 mermaid plugin 的异步渲染），等待它完成 ***
const svgValue = (node as SVG).value;
if (svgValue && typeof svgValue === 'object' && typeof (svgValue as Promise<unknown>).then === 'function') {
  console.log('[imagePlugin/preprocess] Detected SVG node with Promise value (async rendering from mermaid plugin), waiting for it to complete...');

  // 等待 Mermaid 渲染完成
  const renderResult = await svgValue as any;

  if (!renderResult || !renderResult.svg) {
    console.warn('[imagePlugin/preprocess] Mermaid rendering failed or returned invalid result, using placeholder');
    node.data = {
      ...getPlaceHolderImage(options),
      altText: { description: 'Mermaid rendering failed', name: 'Error', title: 'Error' },
    };
    return;
  }

  console.log('[imagePlugin/preprocess] Mermaid Promise resolved, SVG length:', renderResult.svg.length);

  // 更新 node.value 为实际的 SVG 字符串，以便后续 imageResolver 处理
  (node as SVG).value = renderResult.svg;

  // 继续正常流程：src 保持 undefined（SVG 节点没有 url）
  // imageResolver 会通过 node 参数获取 SVG
}
```

**修复逻辑**：
1. ✅ **检测 Promise**：使用 `then` 方法精确检测
2. ✅ **等待解析**：`await svgValue` 等待 Mermaid 渲染完成
3. ✅ **验证结果**：检查 `renderResult.svg` 是否存在
4. ✅ **更新节点**：将 `node.value` 从 Promise 更新为实际的 SVG 字符串
5. ✅ **继续处理**：让后续的 `imageResolver` 正常处理 SVG → PNG 转换

### 调用链路（修复后）

```
1. mermaidPlugin.preprocess()
   - 创建 SVG node
   - node.value = Promise<RenderResult>
   - node.data = { mermaid: value }

2. imagePlugin.preprocess()
   - 检测到 node.value 是 Promise
   - await node.value 等待渲染完成
   - node.value = renderResult.svg (Promise → SVG string)
   - 继续调用 imageResolver(undefined, options, node)

3. defaultImageResolver()
   - 检测到 node.type === "svg"
   - 调用 handleSvg(node, options)
   - 从 node.value 读取 SVG 字符串
   - 转换 SVG → PNG (ArrayBuffer)
   - 返回 IImageOptions { type: 'png', data: ArrayBuffer, transformation: {...} }

4. imagePlugin.preprocess() 继续
   - node.data = {
       type: 'png',
       data: ArrayBuffer,
       transformation: { width, height },
       altText: {...}
     }

5. imagePlugin.inline()
   - 检查 node.data 是否完整
   - 创建 ImageRun 插入 DOCX
   - ✅ 图表正常显示！
```

### 验证结果

**控制台日志**（关键部分）：
```
[md2docx] Found mermaid code block (lang: mermaid)
[md2docx] Processing mermaid diagram (ID: maf4497cd...)
[imagePlugin/preprocess] Processing node: {type: 'svg', hasUrl: false, src: '(undefined)', existingData: 'EXISTS'}
[imagePlugin/preprocess] Detected SVG node with Promise value (async rendering from mermaid plugin), waiting for it to complete...
[md2docx] Mermaid render succeeded (ID: maf4497cd...)
[imagePlugin/preprocess] Mermaid Promise resolved, SVG length: 45678
[handleSvg] Starting SVG to PNG conversion...
[handleSvg] Conversion completed. Blob size: 718591
[imagePlugin/preprocess] Resolved data: {type: 'png', dataSize: 718591, hasData: true}
[imagePlugin] Creating ImageRun with data: {type: 'png', dataSize: 718591, transformation: {...}}
```

**DOCX 文件**：
- ✅ 第一个图表（简单流程图）：正常显示
- ✅ 第二个图表（复杂流程图）：正常显示
- ✅ 第三个图表（饼图）：正常显示
- ✅ 图像清晰，无占位符
- ✅ 所有图表都有正确的尺寸和清晰度

### 关键学习点

1. **异步协作的陷阱**：
   - 两个插件处理同一个异步节点时，不能简单"跳过"
   - 必须明确谁负责等待 Promise，谁负责处理结果

2. **正确的插件职责划分**：
   - **mermaidPlugin**：负责生成 SVG 字符串（异步）
   - **imagePlugin**：负责等待 Promise + 处理 SVG → PNG + 设置 node.data

3. **防御性编程**：
   - inline 阶段的检查帮助我们发现了问题
   - Promise resolve 后的验证确保了健壮性

---

**报告版本**: 2.0（最终版）
**最后更新**: 2025-01-27
**作者**: Claude Code
**状态**: ✅ **问题已完全解决，三个图表全部正常显示**
