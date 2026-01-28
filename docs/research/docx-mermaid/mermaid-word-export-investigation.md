# Mermaid Word 导出问题调查报告

**日期**: 2026-01-26
**问题**: Word 导出时 Mermaid 图表渲染失败
**状态**: 部分解决，仍在调查中

---

## 一、问题描述

### 1.1 初始现象

用户报告两个 Word 导出失败问题：

1. **Mermaid 导出失败**
   - 错误信息：`Error: Invalid SVG: root element is not <svg>`
   - 影响范围：部分 mermaid 图表类型（特别是 C4Deployment、包含 `<br/>` 标签的 subgraph）
   - 特征：同一个 mermaid 在编辑器 preview 模式下正常渲染，但 Word 导出失败

2. **图片导出失败**
   - 错误信息：`Error resolving image: images/image_0001.png InvalidStateError: The source image could not be decoded`
   - 根本原因：`@m2d/image` 插件使用浏览器 `fetch()` API，无法在 Tauri 环境中解析相对路径

### 1.2 环境信息

- **Cherry Markdown**: 0.10.3
- **Mermaid**: 11.12.2（preview 和 @md2docx 使用相同版本）
- **@md2docx/md2docx**: 0.0.1
- **@m2d/mermaid**: 1.2.2
- **Tauri**: 2.x
- **构建工具**: Vite 7.3.1

---

## 二、调查过程

### 2.1 图片导出问题（已解决 ✅）

**根本原因**：
- `@m2d/image` 插件使用 `fetch(imagePath)` 加载图片
- Tauri 环境中，`fetch()` 无法解析本地文件系统的相对路径

**解决方案**：
在 `CherryEditor.vue` 中实现图片预处理：

```typescript
// 1. 读取本地文件为 base64
const convertImageToBase64 = async (imagePath: string): Promise<string> => {
  const absolutePath = resolvePath(currentFilePath, imagePath);
  const imageBytes = await readFile(absolutePath);
  const base64 = arrayBufferToBase64(imageBytes);
  return `data:${mimeType};base64,${base64}`;
};

// 2. 预处理 Markdown，将相对路径图片转换为 base64 data URLs
const preprocessMarkdownImages = async (markdown: string): Promise<string> => {
  // 匹配所有图片语法
  const imageRegex = /!\[(.*?)\]\((.+?)(?:\s+"(.*?)")?\)/g;
  // 转换为 base64
  // ...
};
```

**验证结果**：✅ 图片导出问题已完全解决

---

### 2.2 Mermaid 导出问题（核心问题）

#### 问题特征

1. **subgraph + HTML 标签**（已解决 ✅）
   ```mermaid
   graph TB
       subgraph 用户层["用户层"]
           StudentApp["学员端应用<br/>(专用客户端)"]
       end
   ```

2. **C4Deployment 语法**（未解决 ❌）
   ```mermaid
   C4Deployment
       title 在线培训与考试系统 - Deployment视图
       Person(学员, "学员", "企业内部员工,参加培训和考试")
       Person(培训管理员, "培训管理员", "负责培训课程管理和学员管理")
       Person(监考员, "监考员", "负责...")  <!-- 在这里截断 -->
   ```

#### 调查步骤

##### 步骤 1：对比源代码

对比了两个 mermaid 处理的实现：

| 对比项 | Cherry Markdown | @m2d/mermaid |
|--------|----------------|--------------|
| Mermaid 版本 | 9.4.3 | 11.6.0+ |
| 预处理逻辑 | **无自动 trim** | **有自动 trim** ⚠️ |
| SVG 清理 | ✅ 移除无效属性 | ❌ 无 |
| HTML 标签处理 | 通过 CSS themeCSS 处理 | 移除 HTML 标签 |

##### 步骤 2：发现核心问题

在 `@m2d/mermaid` 源代码中发现了**不合理的自动 trim 逻辑**：

**文件**: `D:\Backup\thirdparty\mermaid-1.2.2\lib\src\index.ts`

```typescript
// 第 104-110 行
// Normalize whitespace unless the diagram type is known to be sensitive
if (!/^mindmap|gantt|gitGraph|timeline/i.test(value)) {
  value = value
    .split("\n")
    .map(line => line.trim())  // ⚠️ 自动 trim 每一行！
    .join("\n");
}
```

**问题分析**：
1. **豁免列表有限**：只豁免了 `mindmap`, `gantt`, `gitGraph`, `timeline`
2. **C4Deployment 不在豁免列表**：会被自动 trim
3. **破坏语法结构**：虽然 trim 本身不应该有破坏性，但在某些边缘情况下可能导致问题
4. **cherry-markdown 没有这个逻辑**：所以 preview 模式正常，导出失败

##### 步骤 3：尝试修复方案

**方案 1：添加白名单**（已废弃 ❌）
```typescript
// 将 c4 添加到豁免列表
if (!/^mindmap|gantt|gitGraph|timeline|c4/i.test(value)) {
  // trim...
}
```

**问题**：治标不治本，遇到新的 mermaid 类型还是会失败

**方案 2：完全移除 trim 逻辑**（当前方案 ✅）
```typescript
// 完全删除那段 trim 代码
// 只保留 mindmap 前缀自动添加的逻辑
```

**实施**：
- 修改了 `node_modules/@m2d/mermaid/dist/*.js` 和 `*.mjs`
- 使用 `pnpm patch` 创建永久补丁
- 生成补丁文件：`patches/@m2d__mermaid@1.2.2.patch`

**补丁内容**：
```diff
- ${n}`),/^mindmap|gantt|gitGraph|timeline/i.test(n)||(n=n.split(`
- `).map(o=>o.trim()).join(`
- `));let u
+ ${n}`);let u
```

---

## 三、尝试过的其他解决方案

### 3.1 在 `preprocessMermaidBlocks` 中预处理

**尝试内容**：
1. 移除 HTML 标签（`<br/>` → 空格）
2. 合并被换行打断的 HTML 标签
3. 合并未闭合引号的行

**结果**：
- ❌ subgraph + HTML 标签问题：通过移除 HTML 标签解决
- ❌ C4Deployment 问题：仍然失败

**当前状态**：已完全禁用此函数（直接返回原始 markdown）

### 3.2 使用 `fixMermaid` 回调

**尝试内容**：
```typescript
fixMermaid: (mermaidCode: string, error: Error): string => {
  // 尝试修复代码
  return fixedCode;
}
```

**问题**：
- `fixMermaid` 在 `mermaid.render()` 失败后才调用
- @m2d/mermaid 的 trim 操作在 render **之前**执行
- 所以 `fixMermaid` 无法阻止 trim 带来的问题

---

## 四、当前状态

### 4.1 已实施的修改

1. **✅ 图片导出修复**：
   - `convertImageToBase64()` - 转换本地图片为 base64
   - `preprocessMarkdownImages()` - 批量预处理图片

2. **✅ @m2d/mermaid 补丁**：
   - 移除了不合理的自动 trim 逻辑
   - 使用 `pnpm patch` 创建永久补丁
   - `patches/@m2d__mermaid@1.2.2.patch` 已生成

3. **✅ 禁用自定义预处理**：
   - `preprocessMermaidBlocks()` 当前直接返回原始代码

### 4.2 验证结果

- ✅ 图片导出：正常工作
- ✅ Subgraph + `<br/>`：正常工作
- ❌ C4Deployment：仍然失败

### 4.3 补丁文件内容

**`patches/@m2d__mermaid@1.2.2.patch`**:
```diff
diff --git a/dist/index.js b/dist/index.js
- ${n}`),/^mindmap|gantt|gitGraph|timeline/i.test(n)||(n=n.split(`
- `).map(o=>o.trim()).join(`
- `));let u
+ ${n}`);let u

diff --git a/dist/index.mjs b/dist/index.mjs
- ${a}`),/^mindmap|gantt|gitGraph|timeline/i.test(a)||(a=a.split(`
- `).map(M=>M.trim()).join(`
- `));let m
+ ${a}`);let m
```

---

## 五、待调查方向

### 5.1 C4Deployment 特定问题

**可能的假设**：
1. Mermaid 11.12.2 对 C4 语法的支持不完善
2. C4 语法本身的特殊字符处理问题
3. SVG 渲染后的验证逻辑问题

**需要验证**：
- 查看 mermaid.render() 返回的具体内容
- 验证返回的 SVG 是否以 `<svg>` 开头
- 检查是否有额外的包装元素

### 5.2 下一步行动

1. **获取详细的渲染日志**：
   ```typescript
   // 在 fixMermaid 中添加详细日志
   fixMermaid: (mermaidCode, error) => {
     console.log('Failed code:', mermaidCode);
     console.log('Error:', error);
     console.log('Error stack:', error.stack);
   }
   ```

2. **对比成功的渲染结果**：
   - 使用 mermaid.render() 单独测试 C4Deployment
   - 查看返回的 SVG 结构

3. **考虑降级 Mermaid 版本**：
   - Cherry-markdown 使用 9.4.3，工作正常
   - @m2d/mermaid 使用 11.6.0+，可能存在兼容性问题

4. **探索替代方案**：
   - 使用 Cherry-markdown 的 mermaid 插件直接渲染
   - 在前端先生成 SVG，再传递给 @md2docx

---

## 六、相关文件

### 6.1 修改的文件

1. **`src/components/CherryEditor.vue`**
   - 新增：`convertImageToBase64()`
   - 新增：`arrayBufferToBase64()`
   - 新增：`preprocessMarkdownImages()`
   - 修改：`preprocessMermaidBlocks()` - 已禁用
   - 修改：`exportDOCX()` - 添加预处理调用

2. **`patches/@m2d__mermaid@1.2.2.patch`**
   - 新增：移除 @m2d/mermaid 的 trim 逻辑

3. **`pnpm-workspace.yaml`**
   - 自动更新：包含 patchedDependencies 配置

### 6.2 参考的源代码

1. **`D:\Backup\thirdparty\mermaid-1.2.2\lib\src\index.ts`**
   - @m2d/mermaid 的源代码
   - 第 104-110 行：问题代码所在位置

2. **`D:\Downloads\cherry-markdown-cherry-markdown-0.10.3\packages\cherry-markdown\src\addons\cherry-code-block-mermaid-plugin.js`**
   - Cherry-markdown 的 mermaid 实现
   - 没有自动 trim 逻辑

---

## 七、总结

### 7.1 已解决的问题

| 问题 | 状态 | 解决方案 |
|------|------|----------|
| 图片导出失败 | ✅ 已解决 | 转换为 base64 data URLs |
| Subgraph + HTML 标签 | ✅ 已解决 | 移除 @m2d/mermaid 的 trim 逻辑 |

### 7.2 未解决的问题

| 问题 | 状态 | 可能原因 |
|------|------|----------|
| C4Deployment 导出失败 | ❌ 未解决 | Mermaid 11.x 对 C4 语法支持不完善 |
| 其他未知 mermaid 类型 | ⚠️ 待测试 | 可能需要进一步的修改 |

### 7.3 技术债务

1. **补丁依赖**：依赖手动修改 node_modules，需要 pnpm patch 来维护
2. **预处理禁用**：`preprocessMermaidBlocks` 完全禁用，可能影响其他功能
3. **版本锁定**：锁定 Mermaid 11.12.2，升级可能需要重新修复

---

## 八、参考资料

- [Mermaid 官方文档](https://mermaid.js.org/)
- [Cherry Markdown 源代码](D:\Downloads\cherry-markdown-cherry-markdown-0.10.3)
- [@m2d/mermaid 源代码](D:\Backup\thirdparty\mermaid-1.2.2)
- [pnpm patch 文档](https://pnpm.io/cli/patch)

---

**报告生成时间**: 2026-01-26
**最后更新**: 2026-01-26
**负责人**: Claude Code Assistant
