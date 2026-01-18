import { ref, watch } from 'vue';

export type FontSizeLevel = 'medium' | 'large' | 'xlarge';

const FONT_SIZE_CONFIGS = {
  medium: {
    label: '中',
    multiplier: 1,
    // 原始 Cherry Markdown 默认值
    sizes: {
      xs: '12px',
      sm: '14px',
      md: '16px',
      lg: '18px',
      xl: '20px',
      '2xl': '24px',
      '3xl': '30px',
    },
    // TOC 使用较小的字体，避免拥挤
    tocSizes: {
      title: '15px',
      item: '14px',
    },
  },
  large: {
    label: '大',
    multiplier: 1.25,
    sizes: {
      xs: '15px',
      sm: '18px',
      md: '20px',
      lg: '23px',
      xl: '25px',
      '2xl': '30px',
      '3xl': '38px',
    },
    // TOC 使用较小的字体，避免拥挤
    tocSizes: {
      title: '15px',
      item: '14px',
    },
  },
  xlarge: {
    label: '超大',
    multiplier: 2,
    sizes: {
      xs: '24px',
      sm: '28px',
      md: '32px',
      lg: '36px',
      xl: '40px',
      '2xl': '48px',
      '3xl': '60px',
    },
    // TOC 使用较小的字体，避免拥挤
    tocSizes: {
      title: '15px',
      item: '14px',
    },
  },
} as const;

// 使用 localStorage 持久化字体大小设置
const STORAGE_KEY = 'cherry-font-size';

const storedFontSize = localStorage.getItem(STORAGE_KEY) as FontSizeLevel | null;
const currentFontSize = ref<FontSizeLevel>(storedFontSize || 'medium');

// 监听变化并持久化
watch(currentFontSize, (newValue) => {
  localStorage.setItem(STORAGE_KEY, newValue);
  // 触发自定义事件，通知 CherryEditor 更新字体大小
  window.dispatchEvent(new CustomEvent('font-size-changed', {
    detail: { level: newValue }
  }));
});

export function useFontSize() {
  const setFontSize = (level: FontSizeLevel) => {
    currentFontSize.value = level;
  };

  const getCurrentConfig = () => {
    return FONT_SIZE_CONFIGS[currentFontSize.value];
  };

  const getSizes = () => {
    return FONT_SIZE_CONFIGS[currentFontSize.value].sizes;
  };

  const getTocSizes = () => {
    return FONT_SIZE_CONFIGS[currentFontSize.value].tocSizes;
  };

  return {
    currentFontSize,
    setFontSize,
    getCurrentConfig,
    getSizes,
    getTocSizes,
    FONT_SIZE_CONFIGS,
  };
}
