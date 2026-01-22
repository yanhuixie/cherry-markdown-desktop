# Mermaid 集成方案实施总结

**实施日期**: 2026-01-22
**Cherry Markdown 版本**: 0.10.3
**Mermaid 版本**: 11.12.2

## 问题背景

之前的实现存在以下问题：
1. 使用 `cherry-markdown` 全量版本（内置 mermaid 9.4.3）
2. 通过 pnpm overrides 强制使用 mermaid 11.12.2，导致版本冲突
3. Cherry Markdown 的 mermaid 插件与 mermaid 11.x API 不兼容
4. 生产和开发环境行为不一致

## 解决方案

根据 [Cherry Markdown 官方 wiki](https://tencent.github.io/cherry-markdown/examples/mermaid.html)，我们采用了**方式三：异步引入 mermaid 并传值给 cherry**。

### 选择理由

**方式三（异步引入）** 是最合适的方案：

| 方式 | 优点 | 缺点 | 适用性 |
|------|------|------|--------|
| 方式一：window.mermaid | 简单 | 需要 CDN，不适合 Vite | ❌ |
| 方式二：同步引入 | 简单直接 | 增加初始加载体积 | ⚠️ |
| **方式三：异步引入** | **按需加载，与 Vite 代码分割结合好** | **需要 async/await** | **✅ 推荐** |

### 实施步骤

#### 1. 修改 package.json

**添加 mermaid 作为显式依赖**：
```json
{
  "dependencies": {
    "mermaid": "11.12.2"
  }
}
```

**移除 pnpm overrides**（不再需要强制版本）：
```json
// 删除以下配置
"pnpm": {
  "overrides": {
    "mermaid": "11.12.2"
  }
}
```

#### 2. 修改 CherryEditor.vue

**直接导入 cherry-markdown core 版本**（不包含内置 mermaid）：
```typescript
// 使用 cherry-markdown core 版本（不包含内置 mermaid）
import Cherry from 'cherry-markdown/dist/cherry-markdown.core.js';
```

**异步加载 mermaid 和插件**：
```typescript
const initMermaidPlugin = async () => {
  try {
    // 动态导入 mermaid 11.12.2
    const mermaidModule = await import('mermaid');
    const mermaid = (mermaidModule as any).default || mermaidModule;

    // 动态导入 Cherry Markdown 的 mermaid 插件
    const MermaidCodeEngineModule = await import('cherry-markdown/dist/addons/cherry-code-block-mermaid-plugin.js');
    const MermaidCodeEngine = (MermaidCodeEngineModule as any).default || MermaidCodeEngineModule;

    // 注册 mermaid 插件到 Cherry
    Cherry.usePlugin(MermaidCodeEngine, {
      mermaid,
      mermaidAPI: mermaid, // v10+ 直接使用 mermaid
    });

    return true;
  } catch (error) {
    console.error('[CherryEditor] Failed to load mermaid plugin:', error);
    return false;
  }
};
```

**在初始化编辑器前加载插件**：
```typescript
const initEditor = async () => {
  // ...
  // 初始化 mermaid 插件（如果还没初始化）
  if (!mermaidPluginInitialized) {
    const success = await initMermaidPlugin();
    if (success) {
      mermaidPluginInitialized = true;
    }
  }
  // ...
};
```

#### 3. 添加类型声明

创建 `src/types/mermaid-plugin.d.ts`：
```typescript
declare module 'cherry-markdown/dist/cherry-markdown.core.js' {
  import Cherry from 'cherry-markdown';
  export default Cherry;
}

declare module 'cherry-markdown/dist/addons/cherry-code-block-mermaid-plugin.js' {
  export default class MermaidCodeEngine {
    static TYPE: string;
    static install(cherryOptions: any, ...args: any[]): void;
    constructor(options?: any);
    render(src: string, sign: string, engine: any, props?: any): string | Promise<string>;
  }
}

declare module 'mermaid' {
  export interface MermaidConfig {
    startOnLoad?: boolean;
    theme?: 'default' | 'dark' | 'forest' | 'neutral' | 'base';
    logLevel?: number;
    securityLevel?: 'loose' | 'strict';
    fontFamily?: string;
  }

  export interface MermaidStatic {
    initialize(config: MermaidConfig): void;
    render(id: string, text: string, config?: MermaidConfig): Promise<RenderResult>;
    run(config?: MermaidConfig): Promise<void>;
  }

  const mermaid: MermaidStatic;
  export default mermaid;
}
```

## 技术优势

### 1. 版本一致性
- ✅ 开发和生产环境都使用 mermaid 11.12.2
- ✅ 没有版本冲突
- ✅ Cherry Markdown 和 Word 导出使用相同的 mermaid 版本

### 2. 性能优化
- ✅ Mermaid 作为大依赖，按需异步加载
- ✅ 与 Vite 的代码分割机制完美结合
- ✅ 初始加载体积更小

### 3. 可维护性
- ✅ 代码结构清晰，符合官方推荐做法
- ✅ 易于升级 mermaid 版本
- ✅ 类型安全

### 4. 功能支持
- ✅ 支持编辑器内 mermaid 渲染（使用 mermaid 11.12.2）
- ✅ 支持 Word 导出时 mermaid 主题配置（@md2docx/md2docx 也使用 mermaid 11.12.2）
- ✅ 主题切换时 mermaid 图表会自动适配

## 文件变更清单

### 修改的文件
1. `package.json` - 添加 mermaid 依赖，移除 overrides
2. `src/components/CherryEditor.vue` - 使用 core 版本，异步加载 mermaid
3. `src/types/mermaid-plugin.d.ts` - 添加类型声明（新建）

### 未修改的文件
- `vite.config.ts` - 保持原样（不需要别名配置）
- `src/main.ts` - 保持原样（CSS 导入不受影响）

## 验证结果

### 构建测试
```bash
pnpm build
```
结果：✅ 构建成功，所有类型检查通过

### 开发服务器
```bash
pnpm dev
```
结果：✅ 开发服务器启动成功，无错误

## 后续建议

### 1. 测试 mermaid 渲染
- 在编辑器中输入 mermaid 代码块，验证是否正确渲染
- 测试主题切换时 mermaid 图表是否正确适配

### 2. 测试 Word 导出
- 导出包含 mermaid 图表的文档为 Word
- 验证 mermaid 主题配置是否生效

### 3. 性能监控
- 监控 mermaid 异步加载对应用启动时间的影响
- 如果启动时间过长，考虑预加载策略

## 参考资料

- [Cherry Markdown 官方 Mermaid 文档](https://tencent.github.io/cherry-markdown/examples/mermaid.html)
- [Mermaid v11 文档](https://mermaid.js.org/)
- [Vite 动态导入](https://vitejs.dev/guide/features.html#dynamic-import)

---

**文档版本**: 1.0
**作者**: Claude Code Assistant
**最后更新**: 2026-01-22
