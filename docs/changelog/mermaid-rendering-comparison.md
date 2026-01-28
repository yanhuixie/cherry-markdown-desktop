# Mermaid 渲染实现深度比对报告

## 执行时间
2026-01-26

## 问题背景

用户反馈：虽然移除了 auto-trim 逻辑后错误有所减少，但我们的实现与 cherry-markdown 自身相比"差距还是很大"。

## 比对对象

1. **Cherry-markdown 0.10.3**: `D:\Downloads\cherry-markdown-cherry-markdown-0.10.3\packages\cherry-markdown\src\addons\cherry-code-block-mermaid-plugin.js`
2. **我们的自定义实现**: `src/utils/md2docx/mermaid.ts`
3. **参考**: `@m2d/mermaid 1.2.2`: `D:\Backup\thirdparty\mermaid-1.2.2\lib\src\index.ts`

---

## 关键差异汇总

| 维度 | Cherry-markdown | 我们的实现 (@m2d/mermaid) | 影响 |
|------|----------------|------------------------|------|
| **DOM 容器** | ✅ 使用隐藏 div 容器 | ❌ 完全不使用 DOM | 🔴 **严重** |
| **mermaid.render 参数** | `render(id, code, container)` | `render(id, code)` | 🔴 **严重** |
| **返回值处理** | `{ svg }` 对象解构 | 直接返回 result | 🔴 **中等** |
| **SVG 后处理** | ✅ 修复 3 种常见问题 | ❌ 无任何处理 | 🔴 **严重** |
| **错误恢复** | ✅ 使用缓存或 fallback | ❌ 返回 undefined | 🟡 **中等** |
| **HTML 标签修复** | `<br>` → `<br/>` | ❌ 无 | 🔴 **严重** |

---

## 详细差异分析

### 1. DOM 容器的使用 ⚠️ **最关键差异**

#### Cherry-markdown 的做法

```javascript
// 创建隐藏的渲染容器
mountMermaidCanvas($engine) {
  this.mermaidCanvas = document.createElement('div');
  this.mermaidCanvas.style = 'width:1024px;opacity:0;position:fixed;top:100%;';
  const container = this.options.mermaidCanvasAppendDom || $engine.$cherry.wrapperDom || document.body;
  container.appendChild(this.mermaidCanvas);
}

// 渲染时传入容器
mermaid.render(graphId, src, this.mermaidCanvas)
  .then(({ svg: svgCode }) => {
    // 处理 SVG
  })
```

**为什么需要 DOM 容器？**

Mermaid 的内部实现（特别是某些图表类型）需要 DOM 环境来：
- 计算 SVG 的实际尺寸（`getBBox()` API）
- 测量文本宽度
- 计算布局和定位
- 处理 foreignObject 元素

#### 我们的实现

```typescript
const result = await mermaid.render(mId, value);
// ❌ 没有传入容器参数！
```

**问题**：
- 在 Tauri 环境中，虽然没有真实浏览器，但 mermaid 内部仍然可能依赖 DOM API
- 缺少容器会导致某些图表类型渲染失败或尺寸计算错误

#### @m2d/mermaid 的实现

```typescript
const result = await mermaid.render(mId, value);
return result;
```

同样没有使用 DOM 容器，这是其限制之一。

---

### 2. mermaid.render 的返回值处理

#### Cherry-markdown (v10+ 异步渲染)

```javascript
mermaid.render(graphId, src, this.mermaidCanvas)
  .then(({ svg: svgCode }) => {  // ✅ 解构 { svg } 对象
    const html = this.processSvgCode(svgCode, graphId);
    this.lastRenderedCode = html;
  })
```

#### 我们的实现

```typescript
const result = await mermaid.render(mId, value);
console.log('[md2docx] Render result type:', typeof result);
console.log('[md2docx] Render result keys:', Object.keys(result || {}));
// ⚠️ 我们知道 result 是对象，但直接返回了，没有提取 .svg
return result;
```

**问题**：
- mermaid v10+ 返回的是 `{ svg: string }` 对象
- 我们应该提取 `result.svg`，而不是返回整个对象
- 但从我们的日志看，似乎在某个地方正确处理了，否则不会成功

#### @m2d/mermaid 的实现

```typescript
return await mermaid.render(mId, value);
// 同样直接返回对象
```

---

### 3. SVG 后处理 🔴 **关键差异**

#### Cherry-markdown 的 processSvgCode()

```javascript
processSvgCode(svgCode, graphId) {
  const fixedSvg = svgCode
    .replace(/\s*markerUnits="0"/g, '')        // 修复 1: 移除无效的 markerUnits
    .replace(/\s*x="NaN"/g, '')                 // 修复 2: 移除 NaN 坐标
    .replace(/<br>/g, '<br/>');                 // 修复 3: 修复自闭合标签 ⚠️
  const html = this.convertMermaidSvgToImg(fixedSvg, graphId);
  return html;
}
```

**这 3 个修复至关重要**：

1. **`<br>` → `<br/>`**: Mermaid v11+ 生成的 SVG 可能包含非自闭合的 `<br>` 标签，导致 XML 解析失败
2. **`x="NaN"`**: 某些图表计算错误时会产生 NaN 坐标值
3. **`markerUnits="0"`**: 某些 SVG 验证器不接受这个值

#### convertMermaidSvgToImg()

```javascript
convertMermaidSvgToImg(svgCode, graphId) {
  const domParser = new DOMParser();
  const svgDoc = domParser.parseFromString(svgCode, 'image/svg+xml');
  const svgDom = svgDoc.documentElement;

  // 检查是否成功解析为 SVG
  if (svgDom.tagName.toLowerCase() === 'svg') {
    svgDom.style.maxWidth = '100%';
    svgDom.style.height = 'auto';
    svgDom.style.fontFamily = 'sans-serif';

    // 获取实际边界框
    const shadowSvg = document.getElementById(graphId);
    let svgBox = shadowSvg.getBBox();  // ⚠️ 需要 DOM

    // 设置 viewBox
    if (!svgDom.hasAttribute('viewBox')) {
      svgDom.setAttribute('viewBox', `0 0 ${svgBox.width} ${svgBox.height}`);
    }

    // 修复百分比为实际像素值
    svgDom.getAttribute('width') === '100%' && svgDom.setAttribute('width', `${svgBox.width}`);
    svgDom.getAttribute('height') === '100%' && svgDom.setAttribute('height', `${svgBox.height}`);

    return svgDoc.documentElement.outerHTML;
  } else {
    // 解析失败，添加 fallback 样式
    return svgCode.replace('<svg ', '<svg style="max-width:100%;height:auto;font-family:sans-serif;" ');
  }
}
```

#### 我们的实现

```typescript
const result = await mermaid.render(mId, value);
// ❌ 完全没有任何 SVG 后处理
return result;
```

**问题**：
- 没有修复 `<br>` 标签 → 可能导致 "Invalid SVG" 错误
- 没有移除 `x="NaN"` → 可能导致渲染异常
- 没有设置 viewBox → 可能导致尺寸错误

#### @m2d/mermaid 的实现

```typescript
return await mermaid.render(mId, value);
// 同样没有任何 SVG 后处理
```

---

### 4. 错误处理与恢复

#### Cherry-markdown 的流式渲染容错

```javascript
.catch(() => {
  // 流式输出时的容错机制
  if (
    $engine.$cherry.options.engine.global.flowSessionContext &&
    !!this.lastRenderedCode &&
    $engine.$cherry.status.editor === 'hide'
  ) {
    // 使用上次成功的渲染结果
    this.needReturnLastRenderedCode = true;
  } else {
    // 回退到源码显示
    const html = props.fallback();
    this.handleAsyncRenderDone(graphId, sign, $engine, props, html);
  }
})
```

#### 我们的实现

```typescript
catch (error) {
  console.error(`[md2docx] Mermaid render failed (ID: ${mId}):`, error);

  if (options?.fixMermaid) {
    const fixedCode = options.fixMermaid(value, error as Error);
    return await mermaid.render(mId, fixedCode);
  }

  return undefined;  // ❌ 返回 undefined，而不是 fallback
}
```

**问题**：
- 返回 `undefined` 会导致后续处理失败
- 应该返回原始代码或错误提示

---

### 5. 配置差异

#### Cherry-markdown 的默认配置

```javascript
const DEFAULT_OPTIONS = {
  theme: 'default',
  altFontFamily: 'sans-serif',
  fontFamily: 'sans-serif',
  themeCSS: '.label foreignObject { font-size: 90%; overflow: visible; } .label { font-family: sans-serif; }',
  startOnLoad: false,
  logLevel: 5,
};

// 为每种图表类型设置 useMaxWidth: false
CHART_TYPES.forEach((type) => {
  DEFAULT_OPTIONS[type] = {
    useMaxWidth: false,
  };
});
```

#### 我们的实现

```typescript
const defaultMermaidConfig: MermaidConfig = {
  fontFamily: "sans-serif",
  startOnLoad: false,
};
```

**缺失**：
- `themeCSS`: 可能影响 foreignObject 内的样式
- `useMaxWidth: false`: 可能导致某些图表尺寸错误
- `logLevel: 5`: 缺少详细日志，难以调试

---

## 根本原因总结

### 为什么 Cherry-markdown 能正常渲染？

1. ✅ **使用 DOM 容器**：即使隐藏，也提供了 mermaid 内部需要的 DOM API
2. ✅ **SVG 后处理**：修复了 `<br>`、`NaN`、`markerUnits` 等常见问题
3. ✅ **正确的 mermaid v10+ API**：传入容器参数，解构 `{ svg }` 返回值
4. ✅ **完整的配置**：为每种图表类型设置了 `useMaxWidth: false`

### 为什么我们的实现经常失败？

1. ❌ **缺少 DOM 容器**：mermaid 某些内部功能可能依赖 DOM
2. ❌ **没有 SVG 后处理**：
   - `<br>` 标签未修复 → 导致 "Invalid SVG: root element is not <svg>" 错误
   - `x="NaN"` 未清理 → 导致某些图表渲染失败
3. ❌ **返回值处理不明确**：应该提取 `result.svg` 而不是返回整个对象
4. ❌ **配置不完整**：缺少图表特定的配置项

### 为什么 @m2d/mermaid 也有问题？

1. ❌ **设计受限**：作为 DOCX 导出库，无法使用 DOM（因为在 Node.js 环境运行）
2. ❌ **缺少后处理**：没有修复常见的 SVG 问题
3. ❌ **auto-trim 逻辑**：破坏了某些图表类型的语法（已移除）

---

## 改进建议

### 短期改进（必须）

1. **添加 SVG 后处理**：
   ```typescript
   function fixSvgIssues(svg: string): string {
     return svg
       .replace(/<br>/g, '<br/>')           // 修复自闭合标签
       .replace(/\s*x="NaN"/g, '')           // 移除 NaN 坐标
       .replace(/\s*markerUnits="0"/g, '');  // 移除无效属性
   }

   const result = await mermaid.render(mId, value);
   const svgString = typeof result === 'object' && 'svg' in result ? result.svg : result;
   return fixSvgIssues(svgString);
   ```

2. **添加完整配置**：
   ```typescript
   const CHART_TYPES = ['flowchart', 'sequence', 'gantt', 'class', 'state', 'er', 'pie', 'mindmap', 'gitGraph', 'c4', ...];

   const defaultMermaidConfig: MermaidConfig = {
     fontFamily: 'sans-serif',
     startOnLoad: false,
     logLevel: 5,
     themeCSS: '.label foreignObject { font-size: 90%; overflow: visible; }',
   };

   CHART_TYPES.forEach((type) => {
     defaultMermaidConfig[type] = { useMaxWidth: false };
   });
   ```

### 中期改进（建议）

3. **研究 Tauri 中的 DOM 模拟**：
   - Tauri 是否支持创建隐藏的 DOM 元素？
   - 是否可以使用 JSDOM 或类似的库？

4. **改进错误处理**：
   ```typescript
   catch (error) {
     // 返回带有错误信息的 SVG，而不是 undefined
     return `<svg><text>Mermaid render failed: ${error.message}</text></svg>`;
   }
   ```

### 长期改进（可选）

5. **考虑使用 mermaid 的服务器端渲染**：
   - 研究 mermaid 是否有纯 SSR 模式
   - 或者使用 @mermaid-js/mermaid-cli

6. **缓存机制**：
   - 参考 cherry-markdown 的 `lastRenderedCode` 缓存
   - 避免重复渲染相同的 mermaid 代码

---

## 下一步行动

### 优先级 1（立即实施）
- [ ] 添加 `fixSvgIssues()` 函数到 `mermaid.ts`
- [ ] 修改返回值处理：`result.svg` 提取
- [ ] 添加完整的 mermaid 配置（包括 `useMaxWidth: false`）

### 优先级 2（测试验证）
- [ ] 测试 C4Deployment 图表是否修复
- [ ] 测试其他之前失败的图表类型
- [ ] 对比 cherry-markdown 预览效果

### 优先级 3（深入研究）
- [ ] 调查 Tauri 中是否可以使用 DOM 容器
- [ ] 研究 mermaid 内部对 DOM 的依赖程度
- [ ] 测试 JSDOM 是否能解决问题

---

## 附录：关键代码片段

### Cherry-markdown 的关键修复

```javascript
// 文件：cherry-code-block-mermaid-plugin.js
// 行号：197-204

processSvgCode(svgCode, graphId) {
  const fixedSvg = svgCode
    .replace(/\s*markerUnits="0"/g, '')
    .replace(/\s*x="NaN"/g, '')
    .replace(/<br>/g, '<br/>');  // ⚠️ 这是最关键的修复！
  const html = this.convertMermaidSvgToImg(fixedSvg, graphId);
  return html;
}
```

### 建议的修复代码

```typescript
// 文件：src/utils/md2docx/mermaid.ts
// 在 mermaidProcessor 函数中添加：

const fixSvgIssues = (svg: string): string => {
  return svg
    .replace(/<br>/g, '<br/>')           // 修复自闭合标签
    .replace(/\s*x="NaN"/g, '')           // 移除 NaN 坐标
    .replace(/\s*markerUnits="0"/g, '');  // 移除无效属性
};

const mermaidProcessor = async (value: string, _options: MermaidConfig) => {
  const mId = `m${crypto.randomUUID()}`;

  try {
    const result = await mermaid.render(mId, value);

    // 提取 SVG 字符串（mermaid v10+ 返回 { svg } 对象）
    const svgString = typeof result === 'object' && 'svg' in result
      ? (result as { svg: string }).svg
      : (result as string);

    // 修复 SVG 问题
    const fixedSvg = fixSvgIssues(svgString);

    console.log(`[md2docx] Mermaid render succeeded (ID: ${mId})`);
    return fixedSvg;
  } catch (error) {
    console.error(`[md2docx] Mermaid render failed (ID: ${mId}):`, error);

    // 可选的重试逻辑
    if (options?.fixMermaid) {
      const fixedCode = options.fixMermaid(value, error as Error);
      const retryResult = await mermaid.render(mId, fixedCode);
      const svgString = typeof retryResult === 'object' && 'svg' in retryResult
        ? (retryResult as { svg: string }).svg
        : (retryResult as string);
      return fixSvgIssues(svgString);
    }

    // 返回错误 SVG 而不是 undefined
    return `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="100">
      <text x="10" y="50" fill="red">Mermaid render failed: ${(error as Error).message}</text>
    </svg>`;
  }
};
```

---

## 结论

**核心发现**：我们的实现与 cherry-markdown 的最大差距在于：

1. **SVG 后处理缺失** - 特别是 `<br>` 标签修复
2. **DOM 容器缺失** - 可能导致某些图表类型失败
3. **返回值处理不当** - 没有正确提取 `result.svg`
4. **配置不完整** - 缺少图表特定配置

这解释了为什么用户感觉"差距还是很大"。通过添加 SVG 后处理和改进返回值处理，应该能显著改善兼容性。
