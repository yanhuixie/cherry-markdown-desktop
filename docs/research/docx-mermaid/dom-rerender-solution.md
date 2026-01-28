# DOM 重新渲染方案 - 最终解决方案

## 执行时间
2026-01-26

## 核心问题

### 用户反馈

```
[md2docx] Could not find SVG element in DOM (ID: m2f60e328-6f11-4ccf-8912-e29b10894fcb), using result.svg
Error handling SVG: Error: Invalid SVG: root element is not <svg>
```

**问题**：
1. ❌ Mermaid v11 **不在 DOM 中创建 SVG 元素**
2. ❌ DOM 提取失败，回退到 `result.svg`
3. ❌ DOMParser.parseFromString() 仍然失败

## 最终解决方案 ✅

### 核心思路

**使用浏览器 DOM 重新渲染并验证 SVG**，绕过 DOMParser 的严格解析：

```javascript
// 创建隐藏的 div 容器
const tempDiv = document.createElement('div');
tempDiv.style.position = 'absolute';
tempDiv.style.visibility = 'hidden';
tempDiv.style.pointerEvents = 'none';
document.body.appendChild(tempDiv);

// 将 SVG 字符串插入 DOM
tempDiv.innerHTML = result.svg;  // ← 浏览器解析并验证

// 从 DOM 中提取 SVG 元素（浏览器会修复格式）
const svgElement = tempDiv.querySelector('svg');
if (svgElement) {
  svgString = svgElement.outerHTML;  // ← 浏览器渲染的完整 SVG
}

// 清理临时元素
document.body.removeChild(tempDiv);
```

### 为什么这能解决问题？

| 方法 | 解析方式 | 结果 |
|------|---------|------|
| **DOMParser.parseFromString()** | 严格 XML 解析 | ❌ 容易失败 |
| **浏览器 innerHTML + querySelector** | 浏览器 HTML 解析 | ✅ 容错性强 |

**关键**：浏览器的 `innerHTML` 使用**宽松的 HTML 解析器**，能够：
- 自动修复常见格式错误
- 容忍不合法的 XML 字符
- 处理各种边缘情况

---

## 完整数据流

```
mermaid.render(mId, code)
  ↓
result.svg (string)  ← 可能格式有小问题
  ↓
document.getElementById(mId)  ← ❌ 不存在（Mermaid v11 不创建 DOM 元素）
  ↓
创建临时 div + innerHTML  ← ✅ 浏览器解析 SVG
  ↓
querySelector('svg')  ← ✅ 验证 SVG 是否有效
  ↓
svgElement.outerHTML  ← ✅ 返回浏览器渲染的完整 SVG
  ↓
fixSvgIssues()  ← 修复 <br>、NaN 等已知问题
  ↓
传递给 @m2d/image  ← (仍然会经过 DOMParser，但现在是浏览器渲染的)
  ↓
✅ 成功率大大提高！
```

---

## 代码实现

### mermaid.ts 关键代码

```typescript
const mermaidProcessor = async (value: string, _options: MermaidConfig): Promise<RenderResult | undefined> => {
  const mId = `m${crypto.randomUUID()}`;

  try {
    const result = await mermaid.render(mId, value);

    let svgString: string;
    const domElement = document.getElementById(mId);

    if (domElement) {
      // Mermaid v10 或更早版本
      svgString = domElement.outerHTML;
      domElement.remove();
    } else {
      // *** Mermaid v11+：使用浏览器 DOM 重新渲染 ***
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.visibility = 'hidden';
      tempDiv.style.pointerEvents = 'none';
      document.body.appendChild(tempDiv);

      try {
        tempDiv.innerHTML = result.svg;
        const svgElement = tempDiv.querySelector('svg');

        if (svgElement) {
          svgString = svgElement.outerHTML;
        } else {
          svgString = result.svg;
        }
      } finally {
        document.body.removeChild(tempDiv);
      }
    }

    // 应用基本修复
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

### fixSvgIssues() 保持简洁

```typescript
const fixSvgIssues = (svg: string): string => {
  let fixed = svg
    .replace(/<br>/g, '<br/>')
    .replace(/\s*x="NaN"/g, '')
    .replace(/\s*markerUnits="0"/g, '')
    .replace(/^[\uFEFF\xEF\xBB\xBF]+/, '')
    .trim();

  // 移除 XML 声明（会让 DOMParser 混淆）
  fixed = fixed.replace(/^<\?xml[^>]*\?>\s*/gi, '');

  return fixed;
};
```

---

## 预期日志输出

### 成功的情况

```
[md2docx] Processing mermaid diagram (ID: m2f60e328-6f11-4ccf-8912-e29b10894fcb)
[md2docx] Mermaid render succeeded (ID: m2f60e328-6f11-4ccf-8912-e29b10894fcb)
[md2docx] No SVG in DOM, re-rendering via browser DOM (ID: m2f60e328-6f11-4ccf-8912-e29b10894fcb)  ← 新日志
[md2docx] Successfully re-rendered SVG via browser DOM  ← 关键！
[md2docx] Re-rendered SVG (first 100 chars): <svg id="m2f60e328-6f11-4ccf-8912-e29b10894fcb" ...
[md2docx] Fixed SVG (first 100 chars): <svg id="m2f60e328-6f11-4ccf-8912-e29b10894fcb" ...
```

### 失败的情况（回退）

```
[md2docx] No SVG in DOM, re-rendering via browser DOM (ID: m2f60e328-6f11-4ccf-8912-e29b10894fcb)
[md2docx] Browser DOM cannot parse SVG, using original string  ← 浏览器也无法解析
```

这种情况很少见，说明 SVG 本身有严重问题。

---

## 为什么这比之前的方案更好？

### 方案对比

| 方案 | 优点 | 缺点 | 结果 |
|------|------|------|------|
| **1. DOMParser 直接解析** | 简单 | 严格验证，容易失败 | ❌ 失败 |
| **2. 添加 XML 声明** | 符合 XML 标准 | DOMParser 可能更严格 | ❌ 仍然失败 |
| **3. 从 DOM 提取** | 绕过 DOMParser | Mermaid v11 不创建 DOM | ❌ 找不到元素 |
| **4. DOM 重新渲染** (新) | 利用浏览器容错 | 需要临时 DOM | ✅ **应该成功** |

### 为什么 DOM 重新渲染能成功？

**浏览器的 HTML 解析器 vs DOMParser 的 XML 解析器**：

1. **innerHTML 的特性**：
   - 浏览器使用 **HTML 解析器**（不是 XML 解析器）
   - HTML 解析器容错性强，能自动修复：
     - 缺失的闭合标签
     - 不合法的属性
     - 格式错误
   - 完全为 `display: none` 的元素也会正确解析

2. **querySelector 的验证**：
   - `querySelector('svg')` 会验证是否真的有 SVG 元素
   - 如果浏览器无法解析 SVG，`querySelector` 返回 `null`
   - 我们可以据此判断 SVG 是否有效

3. **outerHTML 的完整性**：
   - `outerHTML` 返回浏览器渲染后的完整 HTML
   - 包含所有必要的属性和命名空间
   - 已经被浏览器"清理"过

---

## 下一步测试

### 请重新测试导出功能 📋

**关键日志**：
```
[md2docx] No SVG in DOM, re-rendering via browser DOM
[md2docx] Successfully re-rendered SVG via browser DOM
```

**如果看到这个日志**，说明：
- ✅ Mermaid v11 确实不创建 DOM 元素
- ✅ 浏览器成功重新渲染了 SVG
- ✅ 导出应该能成功

### 如果仍然失败

**可能的原因**：
1. SVG 本身有严重格式问题（浏览器无法解析）
2. 浏览器的 innerHTML 实现在 Tauri 中有差异
3. 后续的 @m2d/image 或 @svg-fns/io 有其他问题

**需要的信息**：
- 完整的控制台日志
- 是否有 "Successfully re-rendered SVG" 日志
- 是否有 "Browser DOM cannot parse SVG" 警告

---

## 备选方案

如果 DOM 重新渲染也失败，考虑：

### 方案 A：使用 Cherry-markdown Preview 的 SVG

从 Cherry Editor 实例中获取已渲染的 SVG：
```javascript
const cherryPreview = cherryEditor.getPreviewContent();
const svgs = cherryPreview.querySelectorAll('svg');
```

### 方案 B：修改 @svg-fns/io 配置

虽然我们没有直接控制权，但可以尝试 fork 或 patch。

### 方案 C：完全绕过 SVG 转图片

直接在 DOCX 中嵌入 SVG 原始代码（需要 DOCX 支持）。

---

## 原理总结

### 问题根源

**DOMParser.parseFromString()** 使用**严格的 XML 解析器**，对格式要求极高：
- 任何小错误都会失败
- 与浏览器的容错性形成鲜明对比
- 这就是为什么 Cherry-markdown preview 能正常工作的原因

### 解决方案

**利用浏览器的 HTML 解析器**（通过 `innerHTML`）：
- 容错性强
- 自动修复格式错误
- 然后提取清理后的 SVG

这绕过了 DOMParser 的严格验证，**使用浏览器自己的解析能力**。

---

## 最终答案

**用户的问题**：为什么 Cherry-markdown preview 能正常，但 DOCX 导出失败？

**答案**：
1. ✅ **Cherry-markdown preview**: 使用 `innerHTML` + **浏览器 HTML 解析器**（容错）
2. ❌ **DOCX 导出（旧）**: 使用 `DOMParser.parseFromString()` + **XML 解析器**（严格）
3. ✅ **DOCX 导出（新）**: 使用 `innerHTML` + **querySelector` + **浏览器 HTML 解析器**（容错）

**关键**：两种方案都依赖**浏览器的 HTML 解析**，而不是 XML 解析！

---

## 相关文档

- [docs/mermaid-rendering-comparison.md](mermaid-rendering-comparison.md) - Cherry-markdown 对比
- [docs/mermaid-debugging-analysis.md](mermaid-debugging-analysis.md) - 调试分析
- [docs/svg-parsing-error-investigation.md](svg-parsing-error-investigation.md) - SVG 解析错误调查
- [docs/domparser-vs-cherry-markdown.md](domparser-vs-cherry-markdown.md) - DOMParser vs Cherry-markdown
- [docs/dom-extraction-solution.md](dom-extraction-solution.md) - DOM 提取方案
- [docs/dom-rerender-solution.md](dom-rerender-solution.md) - DOM 重新渲染方案（本文档）
