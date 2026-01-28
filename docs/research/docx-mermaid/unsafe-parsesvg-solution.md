# Unsafe parseSvg 解决方案

## 执行时间
2026-01-26

## 问题回顾

### 用户反馈
```
[md2docx] Successfully re-rendered SVG via browser DOM
Error handling SVG: Error: Invalid SVG: root element is not <svg>
```

**问题**：
- ✅ 浏览器的 `innerHTML` 成功解析 SVG
- ❌ DOMParser.parseFromString() 失败

### 根本原因

**@m2d/image 调用 @svg-fns/io 的 parseSvg 时使用默认的严格模式**：

```javascript
// @m2d/image 的原始代码
let r = parseSvg(svgString);  // ← 默认 strict: true
```

**parseSvg 的默认行为**：
```javascript
// @svg-fns/io 的 parseSvg
parseSvg = (str, options = {}) => {
  const { unsafe = false, strict = true } = options;

  if (unsafe) {
    // 使用 innerHTML（宽容模式）
    const div = document.createElement('div');
    div.innerHTML = str.trim();
    return div.getElementsByTagName('svg')[0];
  } else {
    // 使用 DOMParser（严格模式）← 默认
    const doc = new DOMParser().parseFromString(str, "image/svg+xml").documentElement;
    if (strict && (!doc || doc.nodeName.toUpperCase() !== "SVG")) {
      throw new Error("Invalid SVG: root element is not <svg>");
    }
    return doc;
  }
};
```

---

## 解决方案 ✅

### 核心思路

**修改 @m2d/image，使用 `unsafe: true` 调用 parseSvg**：

```javascript
// 修改后
let r = parseSvg(svgString, { unsafe: true });  // ← 使用 innerHTML 解析
```

### 为什么这能解决问题？

| 方法 | 解析方式 | 结果 |
|------|---------|------|
| **DOMParser.parseFromString()** | 严格的 XML 解析 | ❌ 容易失败 |
| **innerHTML + querySelector** | 浏览器的 HTML 解析 | ✅ 容错性强 |

**关键**：`unsafe: true` 让 @svg-fns/io 使用 **innerHTML** 而不是 **DOMParser**！

---

## 实施的修改

### 1. 创建 pnpm patch

```bash
pnpm patch @m2d/image@1.4.1
```

### 2. 修改源代码

#### 文件 1: `dist/chunk-CG3HP4XW.mjs` (ESM 版本)
```diff
- let a=v(t);
+ let a=v(t,{unsafe:true});
```

#### 文件 2: `dist/svg-utils.js` (CommonJS 版本)
```diff
- let r=(0,y.parseSvg)(t);
+ let r=(0,y.parseSvg)(t,{unsafe:true});
```

### 3. 提交 patch

```bash
pnpm patch-commit "node_modules/.pnpm_patches/@m2d/image@1.4.1"
```

### 4. Patch 文件

生成的 patch 文件：`patches/@m2d__image@1.4.1.patch`

---

## 数据流对比

### 旧方案（失败）

```
mermaid.render(mId, code)
  ↓
result.svg (string)
  ↓
我们的 DOM 重新渲染
  ↓
svgString = svgElement.outerHTML
  ↓
传递给 @m2d/image
  ↓
@m2d/image 调用 parseSvg(svgString, {})
  ↓
@svg-fns/io 使用 DOMParser.parseFromString()
  ↓
❌ Error: Invalid SVG: root element is not <svg>
```

### 新方案（成功）

```
mermaid.render(mId, code)
  ↓
result.svg (string)
  ↓
我们的 DOM 重新渲染（可选，作为额外保险）
  ↓
svgString = svgElement.outerHTML
  ↓
传递给 @m2d/image
  ↓
@m2d/image 调用 parseSvg(svgString, { unsafe: true })  ← 关键修改！
  ↓
@svg-fns/io 使用 innerHTML 解析
  ↓
✅ 成功！
```

---

## 为什么 innerHTML 更宽容？

### DOMParser（XML 解析器）
- 严格的 XML 验证
- 要求格式完全正确
- 对 SVG 的小问题零容忍
- 任何小问题都会抛异常

### innerHTML（HTML 解析器）
- 宽松的 HTML 解析
- 自动修复常见错误
- 容忍格式问题
- 与浏览器实际渲染一致

**这就是为什么 Cherry-markdown preview 能正常工作的原因！**

---

## 与之前方案的关系

### 方案对比

| 方案 | 修改位置 | 是否需要 | 状态 |
|------|---------|---------|------|
| **移除 auto-trim** | src/utils/md2docx/mermaid.ts | ✅ 必需 | 已完成 |
| **SVG 后处理** | src/utils/md2docx/mermaid.ts | ✅ 必需 | 已完成 |
| **DOM 提取** | src/utils/md2docx/mermaid.ts | ❌ 无效（Mermaid v11 不创建 DOM） | 已废弃 |
| **DOM 重新渲染** | src/utils/md2docx/mermaid.ts | ⚠️ 可选（额外保险） | 当前保留 |
| **unsafe parseSvg** | patches/@m2d__image@1.4.1.patch | ✅ **关键** | **新方案** |

### 当前代码状态

**src/utils/md2docx/mermaid.ts**：
- 保留了 DOM 重新渲染逻辑（可选）
- 保留了所有调试日志
- fixSvgIssues() 仍然有用（修复 <br>、NaN 等）

**patches/@m2d__image@1.4.1.patch**：
- **新的关键修复**
- 让 @m2d/image 使用 unsafe 模式解析 SVG

---

## 下一步测试

### 请重新测试导出功能 📋

**预期结果**：
- ✅ 所有 mermaid 图表应该能成功导出
- ✅ C4Context、flowchart、其他图表都应该工作
- ✅ 不应该再出现 "Invalid SVG" 错误

**关键日志**：
```
[md2docx] Successfully re-rendered SVG via browser DOM  ← 我们的代码
(不再有 "Error handling SVG: Invalid SVG")  ← 错误消失！
```

### 如果成功

我们可以：
1. ✅ 移除 mermaid.ts 中的调试代码
2. ✅ 简化或移除 DOM 重新渲染逻辑（因为 unsafe 已经足够）
3. ✅ 保留 fixSvgIssues()（仍然有用）

### 如果仍然失败

需要检查：
1. Patch 是否正确应用
2. @m2d/image 是否真的在使用修改后的代码
3. 是否有其他错误信息

---

## 代码优化建议（如果测试成功）

### 简化 mermaid.ts

如果 unsafe parseSvg 解决了问题，我们可以简化代码：

```typescript
const mermaidProcessor = async (value: string, _options: MermaidConfig): Promise<RenderResult | undefined> => {
  const mId = `m${crypto.randomUUID()}`;

  try {
    const result = await mermaid.render(mId, value);

    // 简化：直接使用 result.svg，不再 DOM 重新渲染
    // 因为 @m2d/image 现在使用 unsafe 模式解析
    const fixedSvg = fixSvgIssues(result.svg);

    return {
      ...result,
      svg: fixedSvg,
    };
  } catch (error) {
    console.error(`[md2docx] Mermaid render failed (ID: ${mId}):`, error);
    return undefined;
  }
};
```

**原因**：
- @m2d/image 现在使用 innerHTML 解析（与我们的 DOM 重新渲染效果相同）
- 不需要重复做同样的事情
- 代码更简洁

---

## 原理总结

### 问题根源

**整个链条中的严格解析**：
```
result.svg (可能有小问题)
  ↓
@m2d/image 的 parseSvg 调用（默认 strict）
  ↓
@svg-fns/io 的 DOMParser（严格 XML 验证）
  ↓
❌ 失败
```

### 解决方案

**切换到宽容解析**：
```
result.svg (可能有小问题)
  ↓
@m2d/image 的 parseSvg 调用（unsafe: true）
  ↓
@svg-fns/io 的 innerHTML（浏览器 HTML 解析）
  ↓
✅ 成功
```

---

## 最终答案

**用户的问题**：为什么 Cherry-markdown preview 能正常渲染 mermaid，但 DOCX 导出失败？

**答案**：
1. ✅ **Cherry-markdown preview**: 使用 `innerHTML` + **浏览器 HTML 解析**（容错）
2. ❌ **DOCX 导出（旧）**: 使用 `DOMParser.parseFromString()` + **严格 XML 验证**
3. ✅ **DOCX 导出（新）**: 使用 `innerHTML` + **浏览器 HTML 解析**（通过 `unsafe: true`）

**关键突破**：通过 pnpm patch 修改 @m2d/image，让它使用 `unsafe: true` 调用 parseSvg，从而使用与 Cherry-markdown 相同的宽容解析方式！

---

## 相关文档

- [docs/mermaid-rendering-comparison.md](mermaid-rendering-comparison.md) - Cherry-markdown 对比
- [docs/mermaid-debugging-analysis.md](mermaid-debugging-analysis.md) - 调试分析
- [docs/svg-parsing-error-investigation.md](svg-parsing-error-investigation.md) - SVG 解析错误调查
- [docs/domparser-vs-cherry-markdown.md](domparser-vs-cherry-markdown.md) - DOMParser vs Cherry-markdown
- [docs/dom-extraction-solution.md](dom-extraction-solution.md) - DOM 提取方案
- [docs/dom-rerender-solution.md](dom-rerender-solution.md) - DOM 重新渲染方案
- [docs/unsafe-parsesvg-solution.md](unsafe-parsesvg-solution.md) - Unsafe parseSvg 方案（本文档）
