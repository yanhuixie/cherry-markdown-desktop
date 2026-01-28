# Mermaid 渲染失败根因分析

## 执行时间
2026-01-26

## 用户的关键观察

> "渲染出错的mermaid，fixMermaid里面的逻辑并未触发，这是不是意味着从mermaid到svg的转换是成功的，只是svg转图片出问题了？"

**答案：是的！这个观察非常准确。**

---

## 数据流分析

### 完整流程

```
Markdown 代码
  ↓
preprocessMermaidBlocks() (已禁用)
  ↓
md2docx()
  ↓
remark-parse → MDAST
  ↓
createMermaidPlugin().preprocess()
  ↓
mermaidProcessor()
  ↓
mermaid.render(mId, value)  ← fixMermaid 只在这里失败时触发
  ↓
RenderResult { svg: string, diagramType: string, ... }
  ↓
fixSvgIssues(svg)  ← 我们的修复
  ↓
返回 RenderResult
  ↓
mdast2docx 处理 SVG 节点
  ↓
???  ← 问题在这里！
  ↓
DOCX 文档
```

### 关键发现

**1. fixMermaid 的作用**

```typescript
// mermaid.ts 行 132-151
if (options?.fixMermaid) {
  console.log('[md2docx] Attempting to fix mermaid code...');
  try {
    const fixedCode = options.fixMermaid(value, error as Error);
    const retryResult = await mermaid.render(mId, fixedCode);
    return fixSvgIssues(retryResult.svg);
  } catch (error1) {
    console.error(`[md2docx] Mermaid render failed even after fix`);
  }
}
```

**fixMermaid 只在 mermaid.render() 抛出异常时触发。**

如果 fixMermaid 没触发，说明：
- ✅ mermaid 代码解析成功
- ✅ mermaid.render() 成功返回 RenderResult
- ✅ SVG 字符串已经生成
- ❌ 问题出在**后续环节**

**2. preprocessMermaidBlocks 已被禁用**

```typescript
// CherryEditor.vue 行 935-939
const preprocessMermaidBlocks = (markdown: string): string => {
  // 临时禁用所有预处理逻辑，直接返回原始内容
  console.log('[CherryEditor] preprocessMermaidBlocks DISABLED - returning original markdown');
  return markdown;
};
```

这个函数已经没有作用了，可以删除。

**3. CherryEditor.vue 中的 fixMermaid**

```typescript
// CherryEditor.vue 行 978-999
fixMermaid: (mermaidCode: string, error: Error): string => {
  console.warn('[CherryEditor] Mermaid render failed:', error.message);
  let fixed = mermaidCode.trim();

  // 检查是否有图表类型声明
  const firstLine = fixed.split('\n')[0].trim().toLowerCase();
  const graphTypes = ['graph', 'flowchart', 'sequencediagram', ...];

  if (!hasValidType) {
    fixed = `graph TD\n${fixed}`;
  }

  return fixed;
}
```

这个 fixMermaid 函数的逻辑非常简单：
- 只处理缺少图表类型声明的情况
- 对于其他问题（如 HTML 标签、语法错误等）**完全无效**

**4. 真正的问题所在**

问题不在 fixMermaid，而在：

**SVG 字符串 → DOCX 图片的转换过程**

让我们看看这个转换是如何进行的：

#### SVG 节点的数据结构

```typescript
// @m2d/mdast 的 SVG 节点定义
export interface SVG extends Node {
    type: "svg";
    value: string | Promise<RenderResult | undefined>;
    data?: SVGData;
}
```

我们的实现：
```typescript
const svgNode: SVG = {
  type: "svg",
  value: mermaidProcessor(value, finalConfig),  // Promise<RenderResult>
  data: { mermaid: value },
};
```

#### mdast2docx 如何处理 SVG 节点？

**这是我们缺失的关键环节！**

mdast2docx 需要将：
- SVG 字符串 (string)
- 或者 RenderResult 对象

转换为：
- DOCX 的 ImageRun
- ImageRun 需要 Buffer（图片二进制数据）

**问题：我们没有看到这个转换过程的代码！**

---

## 诊断步骤

### 第一步：确认问题范围

**请用户提供**：
1. 控制台日志（特别是 `[md2docx]` 开头的日志）
2. 具体失败的 mermaid 代码示例
3. 错误信息

**关键日志**：
- `[md2docx] Mermaid render succeeded` → 说明 mermaid.render() 成功
- `[md2docx] Fixed SVG` → 说明 fixSvgIssues() 成功
- 之后的错误 → 问题在 mdast2docx

### 第二步：定位转换代码

需要找到：
1. mdast2docx 如何处理 SVG 节点的 `value`
2. SVG 字符串如何转换为图片 Buffer
3. 是否使用了外部工具（如 sharp、svg2img 等）

### 第三步：对比 cherry-markdown

**Cherry-markdown 的流程**：
```javascript
// 1. mermaid.render() 返回 { svg }
const { svg } = await mermaid.render(graphId, src, this.mermaidCanvas);

// 2. 修复 SVG
const fixedSvg = processSvgCode(svg, graphId);

// 3. 转换为 img（可选）
if (this.svg2img) {
  const dataUrl = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  svgHtml = `<img class="svg-img" src="${dataUrl}" alt="${graphId}" />`;
}

// 4. 直接插入 DOM
container.innerHTML = svgHtml;
```

**我们的 DOCX 导出流程**：
```typescript
// 1. mermaid.render() 返回 RenderResult
const result = await mermaid.render(mId, value);

// 2. 修复 SVG
const fixedSvg = fixSvgIssues(result.svg);

// 3. 返回 RenderResult
return { ...result, svg: fixedSvg };

// 4. mdast2docx 处理... ??? (问题在这里)
```

---

## 可能的问题

### 问题 1：SVG 字符串没有被正确提取

mdast2docx 可能期望的是纯 SVG 字符串，而不是 RenderResult 对象。

**验证方法**：检查日志中 `Render result keys` 的输出

### 问题 2：缺少 SVG 转图片的工具

DOCX 不支持直接嵌入 SVG，需要将 SVG 转换为 PNG/JPG。

**可能需要的工具**：
- sharp (SVG → PNG)
- svg2img
- magick (ImageMagick)

**验证方法**：检查 package.json 是否有这些依赖

### 问题 3：SVG 内容仍有问题

即使经过 fixSvgIssues()，可能仍有某些问题导致转换失败。

**可能的问题**：
- 缺少必要的属性（viewBox, width, height）
- 不合法的 XML 字符
- 外部资源引用（如字体、图片）

**验证方法**：检查日志中 `Fixed SVG` 的输出

---

## 建议的调试步骤

### 1. 添加详细日志

在 `mermaid.ts` 中添加：

```typescript
// 在返回之前
console.log(`[md2docx] Returning RenderResult:`, {
  hasSvg: !!result.svg,
  svgLength: result.svg.length,
  svgStart: result.svg.substring(0, 200),
  diagramType: result.diagramType,
});
```

### 2. 检查 mdast2docx 的处理

在 `index.ts` 中添加：

```typescript
// 在调用 toDocx 之后
console.log('[md2docx] DOCX conversion completed');
console.log('[md2docx] Result type:', typeof result);
console.log('[md2docx] Result constructor:', result?.constructor?.name);
```

### 3. 测试简单的 SVG

用最简单的 mermaid 代码测试：

```markdown
\```mermaid
graph TD
    A-->B
\```
```

### 4. 对比 cherry-markdown 的输出

1. 在 cherry-markdown preview 中查看生成的 SVG
2. 在控制台查看我们生成的 SVG
3. 对比两者的差异

---

## fixMermaid 的建议

### 当前状态

**CherryEditor.vue 的 fixMermaid**：
- ❌ 只处理缺少图表类型的情况
- ❌ 对于其他问题无效
- ✅ 但因为很少触发，所以影响不大

**建议**：
1. **暂时保留**：虽然逻辑简单，但可以作为最后的防线
2. **或者删除**：因为很少触发，可以直接删除简化代码
3. **或者增强**：参考之前失败的 preprocessMermaidBlocks() 逻辑

### preprocessMermaidBlocks 的建议

**当前状态**：
- 已禁用
- 直接返回原始内容
- 完全没有作用

**建议**：
- **删除**：这个函数已经没有意义了

---

## 总结

### 用户的观察

✅ **完全正确**：如果 fixMermaid 没触发，说明 mermaid 到 SVG 的转换成功了。

### 真正的问题

❌ **不在 fixMermaid**
❌ **不在 preprocessMermaidBlocks**
✅ **在 SVG → DOCX 图片的转换过程**

### 下一步

1. **提供具体错误信息**：控制台日志、失败的 mermaid 代码
2. **定位转换代码**：找到 mdast2docx 处理 SVG 的代码
3. **检查工具依赖**：是否需要 SVG 转图片的工具

---

## 附录：问题排查清单

- [ ] fixMermaid 是否触发？（查看日志）
- [ ] 如果触发，错误信息是什么？
- [ ] mermaid.render() 是否成功？（查看日志）
- [ ] fixSvgIssues() 是否执行？（查看日志）
- [ ] mdast2docx 是否报错？（查看控制台）
- [ ] 具体的错误信息是什么？
- [ ] 失败的 mermaid 代码是什么？
- [ ] 简单的 mermaid 代码是否能成功？
- [ ] package.json 中是否有 SVG 转换工具？
- [ ] 生成的 SVG 字符串是否合法？
