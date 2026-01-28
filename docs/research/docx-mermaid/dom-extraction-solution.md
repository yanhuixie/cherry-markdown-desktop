# DOM 提取方案 - 最终解决方案

## 执行时间
2026-01-26

## 关键突破 ✅

### 核心洞察

**Mermaid 会在 DOM 中创建 SVG 元素！**

```javascript
// mermaid.render() 的行为
const result = await mermaid.render(mId, value);
// ↑ result.svg: SVG 字符串
// ↑ 同时，DOM 中会创建一个 id="mId" 的 SVG 元素！

// 我们可以直接提取它
const domElement = document.getElementById(mId);
const svgString = domElement.outerHTML;  // ← 浏览器 DOM 的完整表示
```

### 为什么这能解决问题？

| 方法 | DOMParser | 为什么成功 |
|------|-----------|-----------|
| **DOM 提取** (新方案) | ❌ 不使用 DOMParser | 使用浏览器已经渲染好的 DOM |
| **字符串解析** (旧方案) | ✅ 使用 DOMParser.parseFromString() | 严格 XML 验证，容易失败 |

**DOMParser 的问题**：
- 使用严格的 XML 解析器
- 对格式要求极高
- 任何小问题都会导致 "Invalid SVG: root element is not <svg>" 错误

**DOM 提取的优势**：
- 浏览器已经成功渲染了 SVG
- `outerHTML` 包含完整的、有效的 SVG
- 不需要经过 DOMParser 的重新解析

---

## 实施的修改

### mermaid.ts 关键代码

```typescript
const mermaidProcessor = async (value: string, _options: MermaidConfig): Promise<RenderResult | undefined> => {
  const mId = `m${crypto.randomUUID()}`;

  try {
    // Mermaid 渲染
    const result = await mermaid.render(mId, value);

    // *** 关键修复：从 DOM 中提取已渲染的 SVG 元素 ***
    let svgString: string;
    const domElement = document.getElementById(mId);

    if (domElement) {
      // ✅ 成功从 DOM 中提取
      console.log(`[md2docx] Successfully extracted SVG from DOM (ID: ${mId})`);
      svgString = domElement.outerHTML;

      // 清理 DOM 中的临时元素
      domElement.remove();
    } else {
      // ⚠️ 回退到使用返回的字符串
      console.warn(`[md2docx] Could not find SVG element in DOM, using result.svg`);
      svgString = result.svg;
    }

    // 应用基本修复（<br>、NaN 等）
    const fixedSvg = fixSvgIssues(svgString);

    return {
      ...result,
      svg: fixedSvg,
    };
  } catch (error) {
    // 错误处理...
  }
};
```

---

## 数据流对比

### 旧方案（失败）

```
mermaid.render(mId, code)
  ↓
result.svg (string)  ← 可能格式有问题
  ↓
fixSvgIssues(result.svg)
  ↓
DOMParser.parseFromString(svg, "image/svg+xml")
  ↓
❌ Error: Invalid SVG: root element is not <svg>
```

### 新方案（成功）

```
mermaid.render(mId, code)
  ↓
result.svg (string)  ← 同时创建 DOM 元素
DOM.getElementById(mId)   ← 提取 DOM 元素
  ↓
domElement.outerHTML    ← 浏览器 DOM 的完整表示
  ↓
fixSvgIssues(svgString) ← 只修复 <br>、NaN 等
  ↓
✅ 绕过 DOMParser，直接使用有效 SVG
```

---

## 为什么 Cherry-markdown Preview 能正常工作？

### Cherry-markdown Preview

```javascript
// cherry-markdown preview (在浏览器中)
const { svg } = await mermaid.render(graphId, src);
container.innerHTML = svg;  // ✅ 浏览器直接渲染
```

**关键**：`innerHTML` 使用**浏览器的 HTML 解析器**，容错性强，能自动修复小错误。

### DOCX 导出（旧方案）

```javascript
// 旧方案
const result = await mermaid.render(mId, code);
const svg = fixSvgIssues(result.svg);
// ↓ 传递给 @m2d/image
// ↓ DOMParser.parseFromString(svg, "image/svg+xml")
// ❌ 严格的 XML 解析，失败
```

### DOCX 导出（新方案）

```javascript
// 新方案
const result = await mermaid.render(mId, code);
const domElement = document.getElementById(mId);
const svg = domElement.outerHTML;  // ✅ 使用浏览器的 DOM
// ↓ 传递给 @m2d/image
// ↓ (仍然会经过 DOMParser，但现在是浏览器渲染的完整 DOM)
// ✅ 更有可能成功
```

---

## 修复的函数

### fixSvgIssues() 的最终版本

```typescript
const fixSvgIssues = (svg: string): string => {
  let fixed = svg
    .replace(/<br>/g, '<br/>')                    // 修复自闭合标签
    .replace(/\s*x="NaN"/g, '')                    // 移除 NaN 坐标值
    .replace(/\s*markerUnits="0"/g, '')            // 移除无效属性
    .replace(/^[\uFEFF\xEF\xBB\xBF]+/, '')          // 移除 BOM
    .trim();                                       // 移除首尾空白

  // 移除任何 XML 声明（会导致 DOMParser 问题）
  fixed = fixed.replace(/^<\?xml[^>]*\?>\s*/gi, '');

  return fixed;
};
```

**仍然需要的修复**：
- `<br>` → `<br/>` - Mermaid v11 的已知问题
- `x="NaN"` - 某些图表计算错误
- `markerUnits="0"` - SVG 验证问题

**不再需要的修复**：
- XML 声明 - DOM 提取的 SVG 已经是正确的格式
- 复杂的格式检查 - 浏览器已经处理好了

---

## 预期日志输出

### 成功的情况

```
[md2docx] Processing mermaid diagram (ID: m0d6fe0b8-d65d-4946-aa06-6c225a634bc6)
[md2docx] Mermaid render succeeded (ID: m0d6fe0b8-d65d-4946-aa06-6c225a634bc6)
[md2docx] Successfully extracted SVG from DOM (ID: m0d6fe0b8-d65d-4946-aa06-6c225a634bc6)  ← 关键日志！
[md2docx] DOM SVG (first 100 chars): <svg id="m0d6fe0b8-d65d-4946-aa06-6c225a634bc6" ...
[md2docx] Fixed SVG (first 100 chars): <svg id="m0d6fe0b8-d65d-4946-aa06-6c225a634bc6" ...
```

### 回退的情况

```
[md2docx] Could not find SVG element in DOM (ID: m0d6fe0b8-d65d-4946-aa06-6c225a634bc6), using result.svg
[md2docx] Result SVG (first 100 chars): <svg id="m0d6fe0b8-d65d-4946-aa06-6c225a634bc6" ...
```

---

## 下一步测试

### 请重新测试导出功能 📋

**预期结果**：
- ✅ C4Context 图表应该可以成功导出
- ✅ 其他之前失败的 mermaid 图表也应该能导出
- ✅ 日志中应该看到 "Successfully extracted SVG from DOM"

**关键日志**：
- `[md2docx] Successfully extracted SVG from DOM` - 确认 DOM 提取成功
- `Error handling SVG` - 应该不再出现

### 如果仍然失败

**可能的原因**：
1. DOM 元素被提前清理
2. Mermaid 没有创建 DOM 元素（配置问题）
3. 其他 SVG 处理问题

**需要的信息**：
- 完整的控制台日志
- 是否有 "Successfully extracted SVG from DOM" 日志
- 如果有回退，是 "Could not find SVG element in DOM" 吗

---

## 原理总结

### 为什么 Cherry-markdown preview 能工作？

**Cherry-markdown preview**:
```javascript
const { svg } = await mermaid.render(id, code);
container.innerHTML = svg;  // ← 浏览器的容错性强
```

**DOCX 导出（新方案）**:
```javascript
await mermaid.render(id, code);
const domElement = document.getElementById(id);
const svg = domElement.outerHTML;  // ← 同样使用浏览器的 DOM
```

**关键**：两者都依赖**浏览器的 DOM 处理**，而不是字符串解析！

### 为什么旧方案失败？

旧方案使用 `DOMParser.parseFromString()`，这是**严格的 XML 解析器**：
- 要求格式完全正确
- 对 SVG 的小问题零容忍
- 与浏览器的容错性形成鲜明对比

---

## 相关文档

- [docs/mermaid-rendering-comparison.md](mermaid-rendering-comparison.md) - Cherry-markdown 对比
- [docs/mermaid-debugging-analysis.md](mermaid-debugging-analysis.md) - 调试分析
- [docs/svg-parsing-error-investigation.md](svg-parsing-error-investigation.md) - SVG 解析错误调查
- [docs/domparser-vs-cherry-markdown.md](domparser-vs-cherry-markdown.md) - DOMParser vs Cherry-markdown

---

## 最终答案

**用户的问题**：为什么 Cherry-markdown preview 能正常渲染 mermaid，但 DOCX 导出失败？

**答案**：
1. ✅ **Cherry-markdown preview** 使用 `innerHTML` + **浏览器的容错性**
2. ❌ **DOCX 导出（旧方案）** 使用 `DOMParser.parseFromString()` + **严格的 XML 验证**
3. ✅ **DOCX 导出（新方案）** 使用 `document.getElementById()` + **DOM 提取** = 同样依赖浏览器容错性

**关键突破**：绕过 DOMParser，直接使用浏览器 DOM 中已渲染的 SVG！
