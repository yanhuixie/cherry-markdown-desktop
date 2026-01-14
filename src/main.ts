import { createApp } from "vue";
import App from "./App.vue";
import "cherry-markdown/dist/cherry-markdown.css";
// 初始化主题（必须在导入其他组件之前）
import "./composables/useTheme";

createApp(App).mount("#app");
