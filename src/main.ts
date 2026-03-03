import { createApp } from "vue";
import App from "./App.vue";
import "cherry-markdown/dist/cherry-markdown.css";
// 初始化主题（必须在导入其他组件之前）
import "./composables/useTheme";

// 初始化 Cherry Markdown 插件（必须在任何组件使用 Cherry 之前）
import { initCherryPlugins } from "./initCherryPlugins";
import { invoke } from "@tauri-apps/api/core";

// 设置前端全局错误处理（托底机制）
function setupGlobalErrorHandlers() {
  // 捕获同步 JavaScript 错误
  window.onerror = (message, source, lineno, colno, error) => {
    const errorInfo = {
      type: "window.onerror",
      message: String(message),
      source,
      line: lineno,
      column: colno,
      stack: error?.stack,
    };

    console.error("[FRONTEND ERROR]", errorInfo);

    // 发送到 Rust 后端记录到日志文件
    invoke("log_frontend", {
      message: `[JS ERROR] ${JSON.stringify(errorInfo)}`,
    }).catch((err) => {
      console.error("[Failed to log error to backend]", err);
    });

    return false; // 让错误继续传播到浏览器控制台
  };

  // 捕获未处理的 Promise rejection
  window.addEventListener("unhandledrejection", (event) => {
    const errorInfo = {
      type: "unhandledrejection",
      reason: String(event.reason),
      promise: event.promise instanceof Promise ? "Promise" : String(event.promise),
      stack: event.reason?.stack,
    };

    console.error("[FRONTEND UNHANDLED REJECTION]", errorInfo);

    // 发送到 Rust 后端记录到日志文件
    invoke("log_frontend", {
      message: `[PROMISE REJECTION] ${JSON.stringify(errorInfo)}`,
    }).catch((err) => {
      console.error("[Failed to log rejection to backend]", err);
    });

    // 阻止默认的控制台错误输出（我们已经自定义处理了）
    event.preventDefault();
  });

  console.log("[Frontend] Global error handlers initialized");
}

// 等待插件初始化完成后再挂载应用
async function bootstrap() {
  // 首先设置全局错误处理（必须在任何可能出错的代码之前）
  setupGlobalErrorHandlers();

  await initCherryPlugins();
  createApp(App).mount("#app");
}

bootstrap();
