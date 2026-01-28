# Mermaid 导出测试指南

**日期**: 2025-01-27
**目的**: 验证大型 Mermaid 图表导出 DOCX 修复效果

---

## 快速测试

### 1. 启动应用

```bash
pnpm tauri dev
```

### 2. 创建测试文件

创建一个新的 Markdown 文件，包含以下内容：

```markdown
# Mermaid 图表测试

## 测试 1：简单流程图
\`\`\`mermaid
graph TD
    A[开始] --> B[处理]
    B --> C[结束]
\`\`\`

## 测试 2：复杂流程图
\`\`\`mermaid
flowchart TD
    A[开始] --> B{判断条件}
    B -->|条件1| C[路径1]
    B -->|条件2| D[路径2]
    B -->|条件3| E[路径3]
    C --> F[合并]
    D --> F
    E --> F
    F --> G[结束]
\`\`\`

## 测试 3：饼图
\`\`\`mermaid
pie title 项目分布
    "前端" : 40
    "后端" : 35
    "测试" : 15
    "运维" : 10
\`\`\`

## 测试 4：时序图
\`\`\`mermaid
sequenceDiagram
    participant A as 用户
    participant B as 系统
    participant C as 数据库

    A->>B: 发起请求
    B->>C: 查询数据
    C-->>B: 返回结果
    B-->>A: 响应数据
\`\`\`

## 测试 5：甘特图
\`\`\`mermaid
gantt
    title 项目开发计划
    dateFormat  YYYY-MM-DD
    section 需求分析
    需求收集    :a1, 2025-01-01, 7d
    需求评审    :a2, after a1, 3d
    section 设计
    系统设计    :b1, after a2, 7d
    UI设计      :b2, after a2, 5d
    section 开发
    后端开发    :c1, after b1, 14d
    前端开发    :c2, after b2, 10d
    section 测试
    集成测试    :d1, after c1, 5d
    上线部署    :d2, after d1, 2d
\`\`\`
```

### 3. 导出为 DOCX

1. 点击工具栏的"另存为 DOCX"按钮
2. 选择保存位置和文件名
3. 等待导出完成

### 4. 检查结果

#### 控制台日志检查

打开浏览器开发者工具（F12），检查控制台输出：

**预期看到的日志**：
```
[CherryEditor] Preprocessing mermaid blocks for DOCX export...
[md2docx] Initializing mermaid plugin with options: ...
[md2docx] Found mermaid code block (lang: mermaid)
[imagePlugin/preprocess] Processing node: { type: 'svg', ... }
[imagePlugin/preprocess] Detected SVG node with Promise value (async rendering), skipping to let mermaid plugin complete first
[md2docx] Processing mermaid diagram (ID: mxxx)
[md2docx] Mermaid render succeeded (ID: mxxx)
[handleSvg] Starting SVG to PNG conversion...
[handleSvg] Conversion completed. Blob size: XXXXX
[imagePlugin] Creating ImageRun with data: {
  type: 'png',
  dataSize: XXXXX,
  transformation: {...}
}
```

**不应该看到的日志**：
```
❌ [imagePlugin/preprocess] Resolved data: { type: 'gif', dataSize: 0, ... }
❌ [handleSvg] Error resolving SVG image
```

#### DOCX 文件检查

1. 打开导出的 DOCX 文件
2. 检查所有 5 个图表：
   - ✅ 所有图表都应该正常显示（不是占位符）
   - ✅ 图像清晰可读
   - ✅ 没有红色 X 或"无法显示该图片"的提示

---

## 测试结果记录

### 成功标准

- [ ] 所有 5 个图表都正常显示
- [ ] 控制台没有错误信息
- [ ] 所有图表的 `type: 'png'`，`dataSize > 0`
- [ ] 每个图表都只处理一次（没有重复处理）

### 失败迹象

- [ ] 任何图表显示为占位符
- [ ] 控制台出现 `type: 'gif', dataSize: 0`
- [ ] 控制台出现错误堆栈
- [ ] 图表重复处理

---

## 高级测试（可选）

### 测试边界情况

#### 1. 超大型图表
```mermaid
gantt
    title 超大项目计划
    dateFormat  YYYY-MM-DD
    section 阶段1
    任务1    :a1, 2025-01-01, 30d
    任务2    :a2, 2025-01-15, 25d
    任务3    :a3, 2025-02-01, 20d
    ... (添加更多任务)
```

#### 2. 无效的 Mermaid 代码
```markdown
\`\`\`mermaid
invalid code here
\`\`\`
```

**预期**：应该显示占位符或错误提示，而不是崩溃

#### 3. 混合内容
```markdown
# 标题

文本段落...

\`\`\`mermaid
graph TD
    A-->B
\`\`\`

更多文本...

\`\`\`mermaid
pie title 数据
    "A" : 50
    "B" : 50
\`\`\`

继续文本...
```

**预期**：图表和文本都应该正确显示

---

## 性能测试

### 导出时间

记录导出包含 5 个图表的文档所需时间：

| 图表数量 | 预期时间 | 实际时间 |
|---------|---------|---------|
| 1 个简单图表 | < 2 秒 | ___ |
| 5 个图表（含复杂） | < 10 秒 | ___ |
| 10 个图表 | < 20 秒 | ___ |

### 文件大小

记录导出文件的大小：

| 图表类型 | 预期大小 | 实际大小 |
|---------|---------|---------|
| 简单流程图 | ~100 KB | ___ |
| 复杂甘特图 | ~500 KB | ___ |

---

## 调试技巧

### 启用详细日志

如果需要更详细的调试信息，可以修改代码：

1. **启用 PNG 下载调试**：
   - 打开 `src/utils/mdast2docx/image/src/svg-utils.ts`
   - 找到第 181 行：`if (blob && false)`
   - 改为：`if (blob && true)`
   - 导出时会将每个图表保存为 PNG 文件到 `docs/research/docx-mermaid/debug/`

2. **启用 Mermaid 代码日志**：
   - 打开 `src/utils/mdast2docx/mermaid/src/index.ts`
   - 取消注释第 120、180、197 行的 `console.log`

### 常见问题排查

#### 问题 1：导出的 DOCX 中图表显示为占位符

**检查项**：
1. 控制台是否显示 `Detected SVG node with Promise value`？
2. 控制台是否显示 `Mermaid render succeeded`？
3. `dataSize` 是否大于 0？

**可能原因**：
- Promise 检测逻辑未生效
- Mermaid 渲染失败
- PNG 转换失败

#### 问题 2：导出时间过长

**优化建议**：
- 减少图表复杂度
- 检查是否有重复处理
- 考虑使用缓存

#### 问题 3：图表模糊

**检查项**：
1. SVG 的原始尺寸
2. DPI 设置（默认 96）
3. Scale 设置（默认 3）

**调整方法**：
- 修改 `CherryEditor.vue` 中的 imagePlugin 配置
- 增加 `scale` 或 `dpi` 值

---

## 测试报告模板

完成测试后，请填写以下报告：

```markdown
## 测试报告

**测试日期**: 2025-01-27
**测试人**: [你的名字]
**版本**: [commit hash 或版本号]

### 测试结果

✅ 通过 / ❌ 失败

### 测试详情

| 图表类型 | 显示正常 | 导出时间 | 文件大小 |
|---------|---------|---------|---------|
| 简单流程图 | ✅/❌ | ___ 秒 | ___ KB |
| 复杂流程图 | ✅/❌ | ___ 秒 | ___ KB |
| 饼图 | ✅/❌ | ___ 秒 | ___ KB |
| 时序图 | ✅/❌ | ___ 秒 | ___ KB |
| 甘特图 | ✅/❌ | ___ 秒 | ___ KB |

### 发现的问题

[描述任何发现的问题]

### 控制台日志

[粘贴关键的控制台日志]

### 截图

[附上 DOCX 文件截图]
```

---

## 下一步

如果测试通过：
1. ✅ 可以提交代码
2. ✅ 更新 CHANGELOG
3. ✅ 合并到主分支

如果测试失败：
1. 📋 记录失败的详细信息
2. 🔍 查看控制台日志
3. 🐛 使用调试技巧定位问题
4. 💬 在 GitHub Issues 中报告问题

---

**文档版本**: 1.0
**最后更新**: 2025-01-27
**作者**: Claude Code
