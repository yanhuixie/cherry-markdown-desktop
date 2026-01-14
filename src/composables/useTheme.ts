import { ref } from 'vue';
import { getCurrentWindow } from '@tauri-apps/api/window';

type Theme = 'light' | 'dark' | 'system';

const THEME_KEY = 'cherry-markdown-theme';

// 全局单例状态
const storedTheme = localStorage.getItem(THEME_KEY) as Theme;
const theme = ref<Theme>(storedTheme || 'system');
const isDark = ref(false);

// 缓存系统主题
let cachedSystemTheme: 'light' | 'dark' = 'light';

// 检测系统主题（使用 Tauri 前端 API）
const getSystemTheme = async (): Promise<'light' | 'dark'> => {
  try {
    const appWindow = getCurrentWindow();
    const sysTheme = await appWindow.theme();
    // Tauri 返回的主题可能是 "dark" 或 "light"
    cachedSystemTheme = sysTheme === 'dark' ? 'dark' : 'light';
    return cachedSystemTheme;
  } catch (error) {
    console.warn('Failed to get Tauri theme, falling back to matchMedia:', error);
    // 降级到使用 window.matchMedia
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      cachedSystemTheme = 'dark';
    } else {
      cachedSystemTheme = 'light';
    }
    return cachedSystemTheme;
  }
};

// 应用主题
const applyTheme = (dark: boolean) => {
  isDark.value = dark;
  // 为我们自己的组件添加 dark 类
  if (dark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  console.log('Theme applied:', dark ? 'dark' : 'light');
};

// 更新主题
const updateTheme = async () => {
  const effectiveTheme = theme.value === 'system' ? await getSystemTheme() : theme.value;
  applyTheme(effectiveTheme === 'dark');
};

// 设置主题
const setTheme = (newTheme: Theme) => {
  theme.value = newTheme;
  localStorage.setItem(THEME_KEY, newTheme);
  updateTheme();
};

// 切换主题（在 light/dark 之间切换）
const toggleTheme = async () => {
  // 如果当前是 system 模式，先获取当前系统主题，然后切换到相反的主题
  if (theme.value === 'system') {
    const currentSystemTheme = await getSystemTheme();
    const oppositeTheme = currentSystemTheme === 'dark' ? 'light' : 'dark';
    setTheme(oppositeTheme);
  } else if (theme.value === 'dark') {
    setTheme('light');
  } else {
    setTheme('dark');
  }
};

// 监听系统主题变化（使用 Tauri 的事件）
if (typeof window !== 'undefined') {
  // 监听 Tauri 的主题变化事件
  import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
    getCurrentWindow().onThemeChanged((event) => {
      const newTheme = event.payload as unknown as 'dark' | 'light';
      cachedSystemTheme = newTheme === 'dark' ? 'dark' : 'light';
      // 如果当前使用的是 system 主题，则更新
      if (theme.value === 'system') {
        updateTheme();
      }
    });
  }).catch(() => {
    // 忽略错误，使用 window.matchMedia 降级方案
  });

  // 降级：使用 window.matchMedia 作为备选
  if (window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', () => {
      if (theme.value === 'system') {
        updateTheme();
      }
    });
  }
}

// 立即应用初始主题（异步）
(async () => {
  await updateTheme();
})();

// 导出的主题状态和方法
export function useTheme() {
  return {
    theme,
    isDark,
    setTheme,
    toggleTheme,
  };
}
