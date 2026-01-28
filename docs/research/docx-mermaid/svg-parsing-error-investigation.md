# SVG 解析错误调查报告

## 执行时间
2026-01-26

## 问题描述

**错误信息**：
```
Error handling SVG: Error: Invalid SVG: root element is not <svg>
```

**观察到的现象**：
1. ✅ `mermaid.render()` 成功返回 RenderResult
2. ✅ SVG 字符串以 `<svg` 开头（前100个字符可以看到）
3. ❌ 后续处理时报错 "root element is not <svg>"
4. ❌ `fixMermaid` 没有触发（说明 mermaid.render() 成功）

---

## 错误来源定位

### 错误来自 `@svg-fns/io` 库

```javascript
// @svg-fns/io/dist/index.js
let i = new DOMParser().parseFromString(e, "image/svg+xml").documentElement;
if (n && (!l || l.nodeName.toUpperCase() !== "SVG")) {
    throw new Error("Invalid SVG: root element is not <svg>");
}
```

**调用链**：
```
我们的代码
  ↓
mdast2docx
  ↓
@m2d/image 插件
  ↓
@svg-fns/io 的 parseSvg() 函数
  ↓
DOMParser.parseFromString(svg, "image/svg+xml")
  ↓
documentElement.nodeName !== "SVG"  ← 错误！
```

---

## 可能的原因

### 1. SVG 字符串本身有问题 ⚠️

**可能的问题**：
- 前面有 BOM 或其他不可见字符
- 前面有换行符或空格
- 包含不合法的 XML 字符
- DOMParser 解析失败

### 2. DOMParser 的限制 ⚠️

在 Tauri 环境中，DOMParser 的行为可能与浏览器不同：
- 可能不支持某些 SVG 特性
- 可能有更严格的验证
- 可能对命名空间处理不同

### 3. @svg-fns/io 的 strict 模式 ⚠️

```javascript
// @svg-fns/io 默认使用 strict 模式
let l = new i().parseFromString(e, "image/svg+xml").documentElement;
if (n && (!l || l.nodeName.toUpperCase() !== "SVG")) {
    throw new Error("Invalid SVG: root element is not <svg>");
}
```

---

## 已实施的修复

### 1. 增强 fixSvgIssues() 函数 ✅

```typescript
const fixSvgIssues = (svg: string): string => {
  return svg
    .replace(/<br>/g, '<br/>')                    // 修复自闭合标签
    .replace(/\s*x="NaN"/g, '')                    // 移除 NaN 坐标值
    .replace(/\s*markerUnits="0"/g, '')            // 移除无效属性
    .replace(/^[\uFEFF\xEF\xBB\xBF]+/, '')          // 移除 BOM
    .trim();                                       // 移除首尾空白
};
```

**新增**：
- 移除 BOM (UTF-8 BOM: `\xEF\xBB\xBF`)
- 移除零宽空格 (`\uFEFF`)
- 自动 trim() 首尾空白

### 2. 添加详细的调试日志 ✅

```typescript
console.log(`[md2docx] Fixed SVG (first 100 chars):`, fixedSvg.substring(0, 100));
console.log(`[md2docx] SVG starts with '<svg':`, fixedSvg.trim().startsWith('<svg'));
console.log(`[md2docx] SVG length:`, fixedSvg.length);

// 检查 SVG 前面是否有非法字符
const trimmed = fixedSvg.trimStart();
console.log(`[md2docx] Trimmed SVG starts with:`, trimmed.substring(0, 50));
if (trimmed !== fixedSvg) {
  console.warn(`[md2docx] SVG has leading whitespace!`);
}
```

---

## 下一步调试步骤

### 第一步：查看新的日志输出 📋

请重新测试导出功能，并提供以下日志：

1. `[md2docx] Fixed SVG (first 100 chars)` - 检查 SVG 开头
2. `[md2docx] SVG starts with '<svg'` - 应该是 `true`
3. `[md2docx] Trimmed SVG starts with` - 检查 trim 后的开头
4. `[md2docx] SVG has leading whitespace!` - 如果出现这个警告

### 第二步：获取完整的 SVG 字符串 📋

如果问题仍然存在，请：

1. 在浏览器控制台找到 `[md2docx] Mermaid render succeeded` 日志
2. 复制对应的 `mId`（例如：`md6d40103-3235-4ce0-a543-c198224b0892`）
3. 在控制台运行：

```javascript
// 假设 mId 是 "md6d40103-3235-4ce0-a543-c198224b0892"
const svgElement = document.getElementById(mId);
const svgCode = svgElement.outerHTML;
console.log('Full SVG:', svgCode);
```

4. 复制完整的 SVG 代码

### 第三步：手动测试 DOMParser 📋

在浏览器控制台运行：

```javascript
// 假设 svgString 是第二步中获取的 SVG 字符串
const parser = new DOMParser();
const doc = parser.parseFromString(svgString, "image/svg+xml");

console.log('documentElement:', doc.documentElement);
console.log('documentElement.nodeName:', doc.documentElement.nodeName);
console.log('documentElement.tagName:', doc.documentElement.tagName);
console.log('documentElement.nodeType:', doc.documentElement.nodeType);
```

---

## 可能的解决方案

### 方案 1：禁用 @svg-fns/io 的 strict 模式 🔧

```typescript
// 需要修改 @m2d/image 的配置
const imagePluginConfig = {
  // ... 其他配置
  strict: false,  // 禁用严格模式
};
```

**问题**：我们无法直接控制 @m2d/image 传递给 @svg-fns/io 的参数。

### 方案 2：绕过 DOMParser，直接使用 SVG 🔧

如果 DOMParser 在 Tauri 环境中有问题，我们可以：

1. 将 SVG 字符串直接传递给 DOCX（如果支持）
2. 使用其他 SVG 解析库（如 xmldom）
3. 预处理 SVG 为其他格式（如 PNG）

### 方案 3：检查 mermaid 生成的 SVG 🔧

可能需要：

1. 在 Cherry-markdown preview 中获取 SVG
2. 对比我们生成的 SVG
3. 找出差异

---

## fixMermaid 和 preprocessMermaidBlocks 的建议

### fixMermaid

**当前状态**：
- 只在 mermaid.render() 失败时触发
- 对于 "Invalid SVG" 错误**没有帮助**（因为 render 已经成功了）

**建议**：
- ✅ **保留** - 虽然逻辑简单，但可以作为最后的防线
- ⚠️ **或者删除** - 如果确定不需要

### preprocessMermaidBlocks

**当前状态**：
- 已完全禁用
- 直接返回原始内容

**建议**：
- ❌ **删除** - 这个函数已经没有意义了

---

## 临时调试代码

如果需要更深入的调试，可以在 mermaid.ts 中添加：

```typescript
// 在返回 RenderResult 之前
console.log('[md2docx] === SVG DEBUG INFO ===');
console.log('[md2docx] Full SVG length:', fixedSvg.length);
console.log('[md2docx] First 200 chars:', fixedSvg.substring(0, 200));
console.log('[md2docx] Last 200 chars:', fixedSvg.substring(fixedSvg.length - 200));
console.log('[md2docx] Char codes of first 10 chars:', Array.from(fixedSvg.substring(0, 10)).map(c => c.charCodeAt(0)));

// 测试 DOMParser
try {
  const parser = new DOMParser();
  const doc = parser.parseFromString(fixedSvg, 'image/svg+xml');
  console.log('[md2docx] DOMParser result:', {
    documentElement: doc.documentElement,
    nodeName: doc.documentElement?.nodeName,
    tagName: doc.documentElement?.tagName,
  });
} catch (e) {
  console.error('[md2docx] DOMParser test failed:', e);
}
console.log('[md2docx] === END DEBUG INFO ===');
```

---

## 总结

### 当前状态

1. ✅ **已确认**：问题不在 mermaid.render()
2. ✅ **已确认**：问题在 SVG 字符串的处理
3. ✅ **已实施**：增强了 SVG 清理逻辑
4. ⏳ **待确认**：新日志输出
5. ⏳ **待定位**：具体的 SVG 问题

### 下一步

**请提供**：
1. 重新导出后的控制台日志
2. 特别是 `[md2docx]` 开头的日志
3. 任何新的错误信息

这样我们才能准确定位问题的根本原因。

---

## 附录：完整的修复历史

### 修复 1：移除 auto-trim 逻辑 ✅
- 移除了 @m2d/mermaid 的不合理 trim 逻辑
- 创建了自定义 md2docx 模块

### 修复 2：添加 SVG 后处理 ✅
- 添加了 fixSvgIssues() 函数
- 修复 `<br>`、`x="NaN"`、`markerUnits="0"`

### 修复 3：增强 SVG 清理 ✅ (当前)
- 添加 BOM 移除
- 添加 trim()
- 添加详细日志

### 待修复：DOMParser 问题 ⏳
- 需要确认 SVG 字符串的完整内容
- 需要测试 DOMParser 的行为
- 可能需要替代方案
