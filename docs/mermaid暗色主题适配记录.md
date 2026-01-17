# Mermaid 暗色主题适配记录

## 问题描述
Cherry Markdown Desktop 已实现亮色/暗色主题切换功能，但 Mermaid 图表的暗色适配不完善：
- 暗色模式下箭线的颜色偏暗，看不清楚
- 箭线的说明文字颜色也偏暗
- 从暗色主题切换回亮色主题时，Mermaid 图表停留在暗色模式

## 尝试的解决方案

### 方案一：CSS 样式覆盖（失败）
**实施时间**：第一轮会话

**方法**：在 App.vue 中添加大量 CSS 规则，使用 `!important` 强制覆盖 Mermaid 的样式

**结果**：❌ 无效。Mermaid 生成的 SVG 元素带有内联样式（通过 `id` 选择器），CSS 外部样式无法覆盖

### 方案二：插件重新注册（失败）
**实施时间**：第一轮会话

**方法**：调用 `Cherry.usePlugin()` 重新注册 Mermaid 插件

**遇到错误**：
```
Uncaught Error: The function `usePlugin` should be called before Cherry is instantiated
```

**结果**：❌ 无效。插件必须在创建任何 Cherry 实例之前注册

### 方案三：页面重新加载（部分成功但有副作用）
**实施时间**：第一轮会话

**方法**：
1. 在 `main.ts` 中读取 localStorage 中的主题配置
2. 预先注册 Mermaid 插件
3. 在主题切换时调用 `location.reload()`

**结果**：✅ Mermaid 主题切换成功，但❌ 会关闭所有打开的标签页

**用户反馈**：*"切换到暗色模式时会把打开的tab关掉，这显然是个bug"*

### 方案四：动态创建渲染器（部分成功）
**实施时间**：第二轮会话

**方法**：
1. 移除页面重新加载逻辑
2. 在 `initEditor()` 中动态创建 `MermaidCodeEngine` 实例
3. 通过 `customRenderer` 传递给 Cherry Markdown
4. 监听 `isDark` 变化，销毁并重建编辑器

**代码**：
```typescript
const initEditor = () => {
  const mermaidRenderer = new MermaidCodeEngine({
    mermaid,
    mermaidAPI: mermaid.mermaidAPI,
    theme: isDark.value ? 'dark' : 'default',
  });

  cherryEditor = new Cherry({
    engine: {
      syntax: {
        codeBlock: {
          customRenderer: {
            mermaid: mermaidRenderer,
          },
        },
      },
    },
  });
};

watch(isDark, () => {
  if (cherryEditor) {
    cherryEditor.destroy();
    cherryEditor = null;
    initEditor();
  }
});
```

**结果**：✅ 暗色主题成功，但❌ 切换回亮色主题时 Mermaid 保持暗色

**用户反馈**：*"从暗色主题切换回亮色主题时，mermaid图还是暗色主题，这是个漏洞"*

### 方案五：修复版本兼容性（问题仍未解决）
**实施时间**：第二轮会话

**发现的问题**：
- 项目使用 Mermaid v11.12.2
- Cherry Markdown 0.10.3 要求 Mermaid v9.4.3

**解决步骤**：
```bash
pnpm remove mermaid
pnpm add mermaid@9.4.3
pnpm add cytoscape
```

**配置调整**（vite.config.ts）：
```typescript
optimizeDeps: {
  include: ['mermaid', 'cytoscape'],
},
resolve: {
  alias: {
    'cytoscape/dist/cytoscape.umd.js': 'cytoscape',
  },
}
```

**结果**：✅ 版本兼容性问题解决，但❌ 暗色到亮色切换问题依旧

### 方案六：Mermaid 全局配置重置（问题仍未解决）
**实施时间**：第二轮会话

**方法**：
```typescript
const initEditor = () => {
  // 重置全局 mermaid 配置
  (window as any).mermaid = mermaid;
  (window as any).mermaid.initialize({
    theme: isDark.value ? 'dark' : 'default',
    startOnLoad: false,
  });

  const mermaidRenderer = new MermaidCodeEngine({
    mermaid,
    mermaidAPI: mermaid.mermaidAPI,
    theme: isDark.value ? 'dark' : 'default',
  });

  // ... 创建 Cherry 实例
};
```

**结果**：❌ 切换到亮色主题时 Mermaid 仍然保持暗色

**用户反馈**：*"还是切换到暗色模式再切换到亮色主题，mermaid依然停留在暗色模式了"*

### 方案七：清空容器 + 延长等待时间（问题仍未解决）
**实施时间**：第三轮会话（当前）

**方法**：
```typescript
watch(isDark, async () => {
  if (cherryEditor) {
    cherryEditor.destroy();
    cherryEditor = null;

    // 清空容器内容
    if (editorRef.value) {
      editorRef.value.innerHTML = '';
    }

    await new Promise(resolve => setTimeout(resolve, 100));
    initEditor();
    await new Promise(resolve => setTimeout(resolve, 200));
  }
});
```

**结果**：❌ 暗色到亮色切换问题依旧

**用户反馈**：*"还是不行"*

## 当前状态

### 工作正常的场景
- ✅ 亮色 → 暗色：Mermaid 图表正确应用暗色主题
- ✅ 不关闭标签页的情况下切换主题

### 存在问题的场景
- ❌ 暗色 → 亮色：Mermaid 图表保持暗色主题

## 技术细节

### Cherry Markdown 版本
- 版本：0.10.3
- Mermaid 插件：`cherry-markdown/dist/addons/cherry-code-block-mermaid-plugin`

### Mermaid 版本
- 当前版本：9.4.3（与 Cherry Markdown 0.10.3 兼容）
- 原版本：11.12.2（不兼容）

### Cherry Markdown 源代码位置
- 本地路径：`D:\Downloads\cherry-markdown-cherry-markdown-0.10.3`
- Mermaid 配置硬编码在 `index.js`：`theme: 'default'`

### 关键文件
- [CherryEditor.vue](../src/components/CherryEditor.vue)：编辑器组件
- [useTheme.ts](../src/composables/useTheme.ts)：主题管理
- [vite.config.ts](../vite.config.ts)：构建配置

## 待尝试的方案

1. **直接操作 Mermaid API**：
   - 在主题切换后调用 `mermaid.init()` 重新渲染
   - 使用 `mermaid.render()` 手动渲染图表

2. **修改 Cherry Markdown 源代码**：
   - 修改 `MermaidCodeEngine` 类，使其支持动态主题切换
   - 移除硬编码的 `theme: 'default'`

3. **强制刷新 Cherry 内部状态**：
   - 清空 Cherry 的缓存
   - 触发 Cherry 的重新渲染机制

4. **监听 Cherry 事件**：
   - 等待 Cherry 的 `afterChange` 事件后再切换主题
   - 确保 Mermaid 完全渲染后再应用样式

### 方案八：彻底重置 Mermaid 全局状态（最终解决方案）
**实施时间**：2025-01-10 第四轮会话

**根本原因分析**：
通过深入分析发现，问题不仅仅是 `initialize()` 只能生效一次，还包括：
1. Mermaid 内部有多层缓存机制
2. DOM 中残留的 SVG 元素会影响新的渲染
3. 全局配置对象需要完全重置，而不是简单修改

**解决方案**：
1. **彻底重置 Mermaid 全局状态**：
   - 清除所有现有的 Mermaid DOM 元素
   - 调用 `mermaid.reset()` 重置内部状态
   - 删除并重建全局配置对象
   - 强制重新初始化

2. **改进的 CustomMermaidCodeEngine**：
   ```typescript
   resetMermaidState() {
     try {
       // 清除内部状态
       if (this.mermaidAPIRefs.reset) {
         this.mermaidAPIRefs.reset();
       }
       
       // 强制重置配置对象
       if (this.mermaidAPIRefs.config) {
         Object.keys(this.mermaidAPIRefs.config).forEach(key => {
           delete this.mermaidAPIRefs.config[key];
         });
         Object.assign(this.mermaidAPIRefs.config, this.options);
       }
       
       // 重置初始化标志并强制重新初始化
       if (this.mermaidAPIRefs.mermaidAPI) {
         this.mermaidAPIRefs.mermaidAPI.globalReset = undefined;
       }
       this.mermaidAPIRefs.initialize(this.options);
     } catch (error) {
       // 降级方案
       if (this.mermaidAPIRefs.config) {
         Object.assign(this.mermaidAPIRefs.config, this.options);
       }
     }
   }
   ```

3. **增强的主题切换逻辑**：
   ```typescript
   const resetMermaidGlobalState = () => {
     // 1. 清除所有 Mermaid DOM 元素
     const existingElements = document.querySelectorAll('.mermaid, [id^="mermaid-"]');
     existingElements.forEach(el => el.parentNode?.removeChild(el));
     
     // 2. 重置 Mermaid 全局状态
     if (mermaid.reset) mermaid.reset();
     
     // 3. 清除内部缓存
     if (mermaid.mermaidAPI?.reset) mermaid.mermaidAPI.reset();
     
     // 4. 重置初始化标志
     delete mermaid.mermaidAPI?.globalReset;
     delete mermaid.mermaidAPI?.config;
     delete mermaid.config;
     
     // 5. 重新初始化
     mermaid.initialize({
       theme: isDark.value ? 'dark' : 'default',
       startOnLoad: false,
       logLevel: 0,
     });
   };
   ```

4. **改进的主题切换监听**：
   - 销毁编辑器后彻底清理 DOM
   - 调用全局状态重置
   - 增加等待时间确保完全初始化
   - 添加强制重新渲染机制

**关键改进**：
- ✅ 彻底清除 Mermaid 的所有内部状态和缓存
- ✅ 强制删除并重建配置对象
- ✅ 清理所有相关的 DOM 元素
- ✅ 添加强制重新渲染机制
- ✅ 增强错误处理和降级方案

**测试文件**：
- 创建了 `test-mermaid.md` 用于验证修复效果

**结果**：🔄 待测试（理论上应该完全解决问题）

**技术要点**：
- 问题的根源是 Mermaid 的多层缓存机制，需要在多个层面进行重置
- 简单的配置修改不足以触发完整的重新渲染
- 必须结合 DOM 清理、状态重置、配置重建等多种手段

## 更新记录

### 2025-01-10 第三轮会话（续）
- 分析 Cherry Markdown 源代码，发现 `MermaidCodeEngine` 构造函数第 135 行调用 `mermaid.initialize()`
- **关键发现**：Mermaid v9.4.3 的 `initialize()` 方法只能生效一次
- 创建自定义的 `CustomMermaidCodeEngine` 类，直接修改 `mermaidAPIRefs.config` 对象绕过限制
- 新增文件：`src/utils/mermaidEngine.ts`
- 修改文件：`src/components/CherryEditor.vue` 使用自定义渲染器
- 安装依赖：`lodash` 和 `@types/lodash`
- **状态**：还是有问题，mermaid的主题切换到暗色之后就不能再切换回亮色了

### 2025-01-10 第三轮会话
- 尝试清空容器内容并延长等待时间
- 问题仍未解决：暗色到亮色切换时 Mermaid 保持暗色

### 2025-01-10 第二轮会话
- 修复 Mermaid 版本兼容性问题（降级到 9.4.3）
- 添加 cytoscape 依赖和 Vite 配置
- 尝试 Mermaid 全局配置重置
- 问题：暗色到亮色切换不生效

### 2025-01-10 第一轮会话
- CSS 样式覆盖方案失败
- 插件重新注册方案失败
- 页面重新加载方案成功但有关闭标签的副作用
- 动态创建渲染器方案部分成功
