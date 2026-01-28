import { createApp } from "vue";
import App from "./App.vue";
import "cherry-markdown/dist/cherry-markdown.css";
// 初始化主题（必须在导入其他组件之前）
import "./composables/useTheme";

// 初始化 Cherry Markdown 插件（必须在任何组件使用 Cherry 之前）
import { initCherryPlugins } from "./initCherryPlugins";

// 等待插件初始化完成后再挂载应用
async function bootstrap() {
  await initCherryPlugins();
  createApp(App).mount("#app");
}

bootstrap();
