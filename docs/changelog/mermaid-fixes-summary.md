# Mermaid 渲染问题修复总结

## 修复日期
2026-01-26

## 问题背景

用户反馈：虽然移除了 auto-trim 逻辑后错误有所减少，但我们的自定义 md2docx 实现与 cherry-markdown 相比"差距还是很大"，仍有许多 mermaid 图表无法导出到 Word。

---

## 深度比对发现

通过详细对比我们实现的 `src/utils/md2docx/mermaid.ts` 与 cherry-markdown 的 `cherry-code-block-mermaid-plugin.js`，发现了 **4 个关键差异**：

### 1. ❌ 缺少 SVG 后处理（最关键）

**Cherry-markdown 的做法**：
```javascript
processSvgCode(svgCode, graphId) {
  const fixedSvg = svgCode
    .replace(/\s*markerUnits="0"/g, '')
    .replace(/\s*x="NaN"/g, '')
    .replace(/<br>/g, '<br/>');  // ⚠️ 最关键的修复！
  return this.convertMermaidSvgToImg(fixedSvg, graphId);
}
```

**我们的实现**：完全没有任何 SVG 后处理

**影响**：
- Mermaid v11+ 生成的 SVG 可能包含非自闭合的 `<br>` 标签
- 导致 XML 解析失败："Invalid SVG: root element is not <svg>"
- 某些图表计算错误时会产生 `x="NaN"` 坐标值
- 某些 SVG 验证器不接受 `markerUnits="0"`

### 2. ❌ 配置不完整

**Cherry-markdown 的配置**：
```javascript
const DEFAULT_OPTIONS = {
  theme: 'default',
  altFontFamily: 'sans-serif',
  fontFamily: 'sans-serif',
  startOnLoad: false,
  logLevel: 5,
};

// 为每种图表类型设置 useMaxWidth: false
CHART_TYPES.forEach((type) => {
  DEFAULT_OPTIONS[type] = { useMaxWidth: false };
});
```

**我们的实现**：只有基本的 `fontFamily` 和 `startOnLoad`

### 3. ❌ 返回类型错误

**问题**：SVG 节点的 `value` 应该是 `string | Promise<RenderResult | undefined>`，但我们返回了 `Promise<string>`

**类型定义**：
```typescript
export interface SVG extends Node {
    type: "svg";
    value: string | Promise<RenderResult | undefined>;
    data?: SVGData;
}

export interface RenderResult {
    svg: string;
    diagramType: string;
    // ... 其他属性
}
```

### 4. ⚠️ DOM 容器依赖（暂时无法解决）

**Cherry-markdown** 使用隐藏的 DOM 容器：
```javascript
this.mermaidCanvas = document.createElement('div');
this.mermaidCanvas.style = 'width:1024px;opacity:0;position:fixed;top:100%;';
container.appendChild(this.mermaidCanvas);

mermaid.render(graphId, src, this.mermaidCanvas)  // 传入容器
```

**我们的限制**：在 Tauri 环境中，mermaid 可能在某些情况下需要 DOM 来计算尺寸（`getBBox()`），但 DOCX 导出是在非 DOM 环境运行的。

---

## 实施的修复

### 1. 添加 SVG 后处理函数 ✅

```typescript
const fixSvgIssues = (svg: string): string => {
  return svg
    .replace(/<br>/g, '<br/>')           // 修复自闭合标签（最关键！）
    .replace(/\s*x="NaN"/g, '')           // 移除 NaN 坐标值
    .replace(/\s*markerUnits="0"/g, '');  // 移除无效的 markerUnits 属性
};
```

### 2. 添加完整的 Mermaid 配置 ✅

```typescript
const CHART_TYPES = [
  'flowchart', 'sequence', 'gantt', 'journey', 'timeline',
  'class', 'state', 'er', 'pie', 'quadrantChart', 'xyChart',
  'requirement', 'architecture', 'mindmap', 'kanban',
  'gitGraph', 'c4', 'sankey', 'packet', 'block', 'radar',
] as const;

const defaultMermaidConfig: MermaidConfig = {
  fontFamily: "sans-serif",
  startOnLoad: false,
  logLevel: 5,
};

// 为每种图表类型设置 useMaxWidth: false（参考 cherry-markdown）
CHART_TYPES.forEach((type) => {
  (defaultMermaidConfig as any)[type] = {
    useMaxWidth: false,
  };
});
```

### 3. 修复返回类型 ✅

```typescript
const mermaidProcessor = async (value: string, _options: MermaidConfig): Promise<RenderResult | undefined> => {
  try {
    const result = await mermaid.render(mId, value);

    // *** 关键修复：应用 SVG 后处理（参考 cherry-markdown）***
    const fixedSvg = fixSvgIssues(result.svg);

    // 返回修复后的 RenderResult 对象
    return {
      ...result,
      svg: fixedSvg,
    };
  } catch (error) {
    // 错误处理...
    return undefined;
  }
};
```

### 4. 改进错误处理 ✅

```typescript
catch (error) {
  if (options?.fixMermaid) {
    const fixedCode = options.fixMermaid(value, error as Error);
    const retryResult = await mermaid.render(mId, fixedCode);

    // 同样需要修复 SVG
    const fixedSvg = fixSvgIssues(retryResult.svg);
    return {
      ...retryResult,
      svg: fixedSvg,
    };
  }

  // 返回 undefined 表示失败（符合类型定义）
  return undefined;
}
```

---

## 修复的文件

### [src/utils/md2docx/mermaid.ts](src/utils/md2docx/mermaid.ts)

**关键改动**：
1. 导入 `RenderResult` 类型
2. 添加 `CHART_TYPES` 常量（21 种图表类型）
3. 添加 `fixSvgIssues()` 函数
4. 更新 `defaultMermaidConfig`（添加 `logLevel` 和图表特定配置）
5. 修改 `mermaidProcessor` 返回类型为 `Promise<RenderResult | undefined>`
6. 在返回前应用 `fixSvgIssues()` 到 `result.svg`
7. 在重试逻辑中也应用 `fixSvgIssues()`

---

## 测试建议

### 优先级 1（必须测试）

1. **包含 `<br/>` 标签的 Mermaid 图表**
   - Subgraph 示例（之前已经可以）
   - 其他包含 HTML 标签的图表

2. **C4Deployment 图表**
   - 之前失败的 C4 示例
   - 验证 `x="NaN"` 问题是否修复

3. **所有 21 种图表类型**
   - flowchart, sequence, gantt, journey, timeline
   - class, state, er, pie, quadrantChart, xyChart
   - requirement, architecture, mindmap, kanban
   - gitGraph, c4, sankey, packet, block, radar

### 优先级 2（对比测试）

4. **与 Cherry-markdown 预览对比**
   - 验证导出结果是否与预览一致
   - 检查样式、字体、尺寸

### 优先级 3（边界情况）

5. **复杂图表**
   - 大型流程图（>50 个节点）
   - 嵌套子图
   - 混合图表类型

6. **错误恢复**
   - 无效的 mermaid 代码
   - 验证是否正确返回 undefined 而不是崩溃

---

## 预期效果

### 应该修复的问题 ✅

1. ✅ `<br>` 标签导致的 "Invalid SVG" 错误
2. ✅ `x="NaN"` 导致的渲染失败
3. ✅ 某些图表类型的尺寸/布局问题（通过 `useMaxWidth: false`）
4. ✅ TypeScript 类型错误

### 可能仍存在的问题 ⚠️

1. ⚠️ 依赖 DOM 的图表类型（如果 mermaid 内部需要 DOM API）
2. ⚠️ 非常复杂的图表（可能有性能或内存问题）
3. ⚠️ 某些边缘情况的 mermaid 语法

---

## 后续改进方向

### 短期（如果仍有问题）

1. **增加更详细的日志**
   - 记录哪些修复规则被触发
   - 记录 SVG 修复前后的对比

2. **添加更多 SVG 清理规则**
   - 参考 cherry-markdown 的 `convertMermaidSvgToImg()` 函数
   - 可能需要处理 viewBox、width、height 等

### 中期（深入研究）

3. **调查 Tauri 中的 DOM 模拟**
   - 是否可以使用 JSDOM 或类似库
   - 研究 mermaid 内部对 DOM 的依赖程度

4. **性能优化**
   - 添加 SVG 处理缓存
   - 参考 cherry-markdown 的 `lastRenderedCode` 缓存机制

### 长期（架构改进）

5. **考虑使用 mermaid-cli**
   - 服务器端渲染
   - 完全绕过 DOM 依赖

6. **自定义 SVG 处理管道**
   - 更精细的控制
   - 更好的错误处理

---

## 技术债务

1. **类型安全**：使用 `(defaultMermaidConfig as any)[type]` 绕过类型检查
   - 可以考虑扩展 `MermaidConfig` 类型定义

2. **DOM 容器问题**：暂时无法使用 DOM 容器
   - 需要进一步研究 mermaid 内部实现
   - 可能需要向 mermaid 项目提交 issue

3. **测试覆盖**：缺少自动化测试
   - 应该添加单元测试
   - 应该添加集成测试

---

## 相关文档

- [深度比对报告](mermaid-rendering-comparison.md) - 详细的差异分析
- [Cherry-markdown 源码](https://github.com/Tencent/cherry-markdown) - 参考实现
- [Mermaid 官方文档](https://mermaid.js.org/) - API 参考

---

## 参考代码位置

### Cherry-markdown 的关键实现

**文件**：`D:\Downloads\cherry-markdown-cherry-markdown-0.10.3\packages\cherry-markdown\src\addons\cherry-code-block-mermaid-plugin.js`

**关键函数**：
- `processSvgCode()` (行 197-204) - SVG 后处理
- `convertMermaidSvgToImg()` (行 159-195) - SVG 转换和验证
- `DEFAULT_OPTIONS` (行 43-58) - 完整配置
- `CHART_TYPES` (行 19-41) - 图表类型列表

### 我们的实现

**文件**：`d:\develop\runlefei\CherryMarkdownDesktop\src\utils\md2docx\mermaid.ts`

**关键函数**：
- `fixSvgIssues()` (行 77-82) - SVG 后处理（新增）
- `mermaidProcessor()` (行 103-156) - Mermaid 渲染（已修复）
- `defaultMermaidConfig` (行 49-61) - 完整配置（已扩展）

---

## 总结

通过深入分析 cherry-markdown 的实现，我们发现了关键的 **SVG 后处理缺失** 问题，并添加了完整的修复：

1. ✅ 修复 `<br>` → `<br/>`（最关键）
2. ✅ 移除 `x="NaN"` 无效坐标
3. ✅ 移除 `markerUnits="0"` 无效属性
4. ✅ 添加完整的图表类型配置
5. ✅ 修复 TypeScript 类型错误
6. ✅ 改进错误处理

这些修复应该能显著缩小我们与 cherry-markdown 的差距，解决大部分 mermaid 导出问题。

**下一步**：请用户测试之前失败的 C4Deployment 和其他图表类型，验证修复效果。
