# Cherry Markdown Desktop

基于 Cherry Markdown 和 Tauri 的桌面版 Markdown 编辑器。
因开发环境限制，目前只支持 Windows 10 / 11。如果需要 Linux 或者 MacOS 版本，请自行编译。

最初我使用广为人知的Typora，它很强大易用，后来换成了MarkText，也是一个很优秀的Markdown编辑器。  
只是MarkText已经多年未更新，在打开较大文档时，性能较弱，阅读体验不够顺畅，对mermaid语法的支持也跟不上时代，所以打算再找一个开源的平替。  
现在 SDD 时代，作为一个码农天天都在审markdown文档，工具不给力是真的很难受了，我在vs code扩展库里找到一个 Markdown Preview Enhanced ，颇为惊艳，适合在vs code里阅读和编辑markdown文档。  
但我还是希望有一个独立的markdown阅读器/编辑器，因为我并不总是想开着vs code，而且一旦开了vs code，笔记本嗖嗖掉电量，在频繁移动办公的场合会比较焦虑。  
最近听说了腾讯开源的 Cherry Markdown 组件，足够强大足够美观易用，只是竟然没有找到一个合适的桌面版，所以决定还是自己Vibe一个吧。  
搞了几天基本可用了，分享出来给需要的小伙伴们。

20260117 补充：  
后来我才知道其实 Cherry Markdown 官方也提供了一个基于 Tauri 的客户端，它正在开发中，尚未正式发布。参考 [官方客户端](https://github.com/Tencent/cherry-markdown/tree/dev/packages/client) 。欢迎小伙伴们为官方客户端贡献力量。

## 功能特点

![界面截图-1](docs/snapshot-1.png)
![界面截图-2](docs/snapshot-2.png)

### 核心编辑功能

- ✅ 完整的 Markdown 编辑支持（基于 Cherry Markdown）
- ✅ 多种编辑模式：纯预览、双栏编辑/预览
- ✅ 语法高亮、代码块、数学公式、Mermaid 图表支持

### 文件操作

- ✅ 新建 Markdown 文件
- ✅ 打开本地文件（支持 `Ctrl+O` 快捷键）
- ✅ 保存文件（支持 `Ctrl+S` 快捷键）
- ✅ 另存为功能
- ✅ 多标签页编辑，支持同时打开多个文件
- ✅ 自动记录最近打开的文件（最多 20 个）

### 用户体验

- ✅ 桌面原生应用体验（Tauri 2.x）
- ✅ 编辑器字号调节（中、大、特大三档）
- ✅ 亮色/暗色主题切换
- ✅ 编辑器模式自动保存与恢复
- ✅ 外部文件修改监控与重新加载确认
- ✅ 关闭标签页/窗口时未保存变更提示
- ✅ 单实例运行支持（双击文件自动在已打开实例中打开）
- ✅ 点击 Markdown 内部链接自动在新标签中打开
- ✅ 关于对话框
- ✅ Word 文档（.docx）导出功能
- ✅ 多格式导出（HTML、PDF、Word）
- ✅ 等宽字体切换功能
- ✅ 标签页管理（关闭左侧/右侧/全部、关闭确认对话框）
- ✅ 前端日志系统
- ✅ Mermaid 图表动态加载与暗色主题支持

### 技术特性

- ✅ 跨平台桌面框架（目前主要支持 Windows 10/11）
- ✅ 轻量级状态管理（Vue 3 Composition API）
- ✅ 响应式界面设计

## 环境要求

在运行此项目之前，需要安装以下工具：

### 1. Node.js

当前版本: v22.16.0

### 2. Rust 工具链

Tauri 需要 Rust 编译工具链。

### 3. WebView2 (Windows 10/11)

Windows 10/11 通常已预装，如需安装:
https://developer.microsoft.com/en-us/microsoft-edge/webview2/

## 使用方法

### 开发模式运行

安装完 Rust 后，执行:

```bash
npm run tauri dev
```

这将启动开发服务器并打开应用窗口。

### 构建桌面应用

构建 Windows 可执行文件:

```bash
npm run tauri build
```

构建完成后，可执行文件位于:
`src-tauri/target/release/CherryMarkdownDesktop.exe`

## 项目结构

## 技术栈

- **前端**: Cherry Markdown (Markdown 编辑器)
- **桌面框架**: Tauri 2.9.x
- **构建工具**: Vite 6.x / 7.x
- **后端语言**: Rust

## 注意事项

- 首次运行开发模式时，Tauri 会编译 Rust 代码，可能需要几分钟
- 确保已安装 WebView2 (Windows)
- 开发模式下应用监听 http://localhost:3000

## 开源协议

Apache 2.0
