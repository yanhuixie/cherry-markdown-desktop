# DOMParser 解析 SVG 失败的根本原因

## 执行时间
2026-01-26

## 核心问题

**为什么 Cherry-markdown preview 正常，但 DOCX 导出失败？**

### Cherry-markdown Preview (浏览器 DOM)
```javascript
// cherry-markdown preview
const { svg } = await mermaid.render(graphId, src);
container.innerHTML = svg;  // ✅ 直接插入 DOM
```

**为什么成功**：
- 浏览器的 `innerHTML` 容错性强
- 浏览器会自动修复小错误
- 不需要严格的 XML 验证

### DOCX 导出 (DOMParser)
```javascript
// 我们的流程
const result = await mermaid.render(mId, value);
const fixedSvg = fixSvgIssues(result.svg);
// ↓ 传递给 @m2d/image

// @m2d/image 的处理
const renderResult = await node.value;  // RenderResult 对象
const svgString = renderResult.svg;     // 提取 SVG 字符串
// ↓ 传递给 @svg-fns/io

// @svg-fns/io 的 parseSvg
const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
// ❌ 严格解析，容易失败
```

**为什么失败**：
- `DOMParser.parseFromString()` 使用**严格的 XML 解析**
- 对格式要求非常高
- 任何小问题都会导致解析失败

---

## 数据流完整分析

### 第一步：我们的代码 (mermaid.ts)
```typescript
// 返回 RenderResult 对象
return {
  diagramType: "c4",
  svg: fixedSvg,  // SVG 字符串
  bindFunctions: ...
};
```

### 第二步：@m2d/image 提取 SVG
```javascript
// @m2d/image/dist/index.js (压缩后)
let i = t.value;  // SVG 节点的 value (Promise<RenderResult>)
let l = await i;  // await 得到 RenderResult 对象
n = e.fixGeneratedSvg(l.svg, l);  // ← 提取 l.svg 属性
```

**关键**：`l.svg` 是我们修复后的 SVG 字符串。

### 第三步：调用 @svg-fns/io
```javascript
// @m2d/image 调用 L 函数
L = (t, e) => new Promise((i, n) => {
  let a = R.parseSvg(t);  // ← t 是 SVG 字符串
  // R 是 @svg-fns/io 的 parseSvg 函数
})
```

### 第四步：@svg-fns/io 使用 DOMParser
```javascript
// @svg-fns/io/dist/index.js
parseSvg = (str, options = {}) => {
  const domParser = options.domParser || window.DOMParser;
  const doc = new domParser().parseFromString(str, "image/svg+xml").documentElement;

  if (options.strict !== false && (!doc || doc.nodeName.toUpperCase() !== "SVG")) {
    throw new Error("Invalid SVG: root element is not <svg>");
  }

  return doc;
}
```

**问题**：`doc.nodeName` 不是 "SVG"，解析失败！

---

## 可能的原因

### 1. 缺少 XML 声明 ⚠️

Mermaid 生成的 SVG：
```xml
<svg id="..." xmlns="http://www.w3.org/2000/svg">
  ...
</svg>
```

DOMParser 可能期望：
```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg id="..." xmlns="http://www.w3.org/2000/svg">
  ...
</svg>
```

### 2. 命名空间问题 ⚠️

虽然 SVG 有 `xmlns="http://www.w3.org/2000/svg"`，但可能：
- 命名空间声明位置不对
- 多个命名空间冲突
- 内部元素的命名空间问题

### 3. SVG 内部有非法字符 ⚠️

可能的非法字符：
- 不合法的 XML 字符（如控制字符）
- CDATA 块处理不当
- 实体引用（如 `&nbsp;`）未正确转义
- 外部资源引用（如 `xlink:href`）

### 4. DOMParser 的严格模式 ⚠️

`@svg-fns/io` 默认使用 `strict: true`：
```javascript
if (options.strict !== false && ...) {
  throw new Error("Invalid SVG: root element is not <svg>");
}
```

---

## 实施的修复

### 修复：添加 XML 声明 ✅

```typescript
const fixSvgIssues = (svg: string): string => {
  let fixed = svg
    .replace(/<br>/g, '<br/>')
    .replace(/\s*x="NaN"/g, '')
    .replace(/\s*markerUnits="0"/g, '')
    .replace(/^[\uFEFF\xEF\xBB\xBF]+/, '')
    .trim();

  // *** 关键修复：添加 XML 声明 ***
  if (!fixed.startsWith('<?xml')) {
    fixed = '<?xml version="1.0" encoding="UTF-8"?>\n' + fixed;
  }

  return fixed;
};
```

**为什么可能有效**：
- XML 声明告诉 DOMParser 这是 XML 文档
- 明确指定编码为 UTF-8
- 触发正确的 XML 解析模式

---

## Cherry-markdown 为什么不需要这些修复？

### 浏览器的容错机制

1. **innerHTML 自动修复**
   ```javascript
   container.innerHTML = '<svg>...';  // 浏览器自动处理
   ```

2. **宽松的 HTML 解析**
   - 浏览器使用 HTML 解析器，不是 XML 解析器
   - HTML 解析器容错性强
   - 自动修复常见错误

3. **DOM API 的灵活性**
   - `createElementNS()` 可以直接创建 SVG 元素
   - 不需要字符串解析

### DOCX 导出的严格要求

1. **DOMParser.parseFromString()**
   - 使用 XML 解析器
   - 严格验证格式
   - 不容错

2. **@svg-fns/io 的严格模式**
   - 默认 `strict: true`
   - 明确检查 `nodeName === "SVG"`
   - 任何小错误都抛异常

---

## 下一步测试

### 请重新测试导出功能

**预期结果**：
- ✅ 如果添加 XML 声明解决了问题，C4Context 图表应该可以导出
- ❌ 如果仍然失败，需要进一步诊断

**新的日志**：
```
[md2docx] Fixed SVG (first 100 chars): <?xml version="1.0" encoding="UTF-8"?>
<svg id="..." ...
```

### 如果仍然失败

需要更深入的调试：

1. **获取完整 SVG 字符串**
   - 在控制台找到 `[md2docx] Mermaid render succeeded` 日志
   - 运行以下代码获取完整 SVG：

```javascript
// 复制日志中的 ID，例如 "mb1abda4f-5c0a-4919-b3e1-442313834219"
const svgElement = document.getElementById('mb1abda4f-5c0a-4919-b3e1-442313834219');
console.log(svgElement.outerHTML);
```

2. **手动测试 DOMParser**
   ```javascript
   const svgString = document.getElementById('...').outerHTML;
   const parser = new DOMParser();
   const doc = parser.parseFromString(svgString, "image/svg+xml");
   console.log('documentElement:', doc.documentElement);
   console.log('nodeName:', doc.documentElement.nodeName);
   ```

3. **检查 SVG 内部**
   - 查找非法字符
   - 检查命名空间
   - 验证 XML 实体引用

---

## 备选方案

如果 XML 声明不能解决问题，考虑：

### 方案 1：禁用 strict 模式
```typescript
// 需要修改 @m2d/image 的配置
// 但我们无法直接控制传递给 @svg-fns/io 的参数
```

### 方案 2：使用 Cherry-markdown 的 SVG
```typescript
// 从 preview 中获取已渲染的 SVG
const svgElement = document.querySelector(`#${mId}`);
const svgString = svgElement.outerHTML;
```

### 方案 3：绕过 DOMParser
```typescript
// 直接使用字符串操作，不解析
// 或使用更宽松的解析器
```

---

## 总结

### 问题根源

**Cherry-markdown preview**：
- 使用浏览器 `innerHTML` (HTML 解析器，容错性强)

**DOCX 导出**：
- 使用 `DOMParser.parseFromString()` (XML 解析器，严格验证)

### 修复策略

添加 XML 声明，确保 DOMParser 正确识别为 XML 文档：
```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg ...>
  ...
</svg>
```

### 测试建议

1. ✅ 重新测试 C4Context 图表导出
2. ✅ 查看新的日志输出
3. ✅ 确认是否还有 "Invalid SVG" 错误

---

## 相关文档

- [docs/mermaid-rendering-comparison.md](mermaid-rendering-comparison.md) - Cherry-markdown 对比分析
- [docs/mermaid-debugging-analysis.md](mermaid-debugging-analysis.md) - 调试分析
- [docs/svg-parsing-error-investigation.md](svg-parsing-error-investigation.md) - SVG 解析错误调查
