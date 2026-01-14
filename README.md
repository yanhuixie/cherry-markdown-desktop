# Cherry Markdown Desktop

基于 Cherry Markdown 和 Tauri 的桌面版 Markdown 编辑器。
因开发环境限制，目前只支持 Windows 10 / 11。如果需要 Linux 或者 MacOS 版本，请自行编译。

最初我使用Typora，它很强大易用，后来换成了MarkText，也是一个很优秀的Markdown编辑器。
只是MarkText已经多年未更新，在打开较大文档时，性能较弱，阅读体验不够顺畅，对mermaid语法的支持也跟不上时代，所以打算再找一个开源的平替。
现在 SDD 时代，作为一个码农天天都在审markdown文档，工具不给力是真的很难受了，我在vs code扩展库里找到一个 Markdown Preview Enhanced ，颇为惊艳，适合在vs code里阅读和编辑markdown文档。
但我还是希望有一个独立的markdown阅读器/编辑器，因为我并不总是想开着vs code，而且一旦开了vs code，笔记本嗖嗖掉电量，在频繁移动办公的场合会比较焦虑。
最近听说了腾讯开源的 Cherry Markdown 组件，足够强大足够美观易用，只是竟然没有找到一个合适的桌面版，所以决定还是自己Vibe一个吧。
搞了几天基本可用了，分享出来给需要的小伙伴们。

## 功能特点

- ✅ 完整的 Markdown 编辑支持
- ✅ 所见即所得的编辑体验
- ✅ 新建、打开、保存文件
- ✅ 另存为功能
- ✅ 桌面原生应用体验
- ✅ 暗色主题适配（深海）

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
