import { ref, computed } from 'vue';

/**
 * 字体类型配置
 */
export interface FontFamilyConfig {
  monospace: 'monospace';
  sansSerif: 'sans-serif';
}

export type FontFamilyType = keyof FontFamilyConfig;

/**
 * 字体类型配置
 */
export const FONT_FAMILY_CONFIGS: FontFamilyConfig = {
  monospace: 'monospace',
  sansSerif: 'sans-serif',
};

/**
 * 管理等宽字体状态的composable
 */
export function useFontFamily() {
  // 使用ref存储当前字体类型，默认使用衬线体（常规）
  const currentFontFamily = ref<FontFamilyType>('sansSerif');

  // 计算当前是否为等宽字体
  const isMonospace = computed(() => currentFontFamily.value === 'monospace');

  // 切换字体类型
  function toggleFontFamily() {
    currentFontFamily.value = isMonospace.value ? 'sansSerif' : 'monospace';
    // 保存到localStorage
    localStorage.setItem('cherry-preview-font-family', currentFontFamily.value);
    // 派发事件通知其他组件
    window.dispatchEvent(new CustomEvent('font-family-changed', {
      detail: { isMonospace: isMonospace.value }
    }));
    console.log('[useFontFamily] Font family changed to:', currentFontFamily.value);
  }

  // 设置特定字体类型
  function setFontFamily(type: FontFamilyType) {
    currentFontFamily.value = type;
    localStorage.setItem('cherry-preview-font-family', type);
    // 派发事件通知其他组件
    window.dispatchEvent(new CustomEvent('font-family-changed', {
      detail: { isMonospace: isMonospace.value }
    }));
    console.log('[useFontFamily] Font family set to:', type);
  }

  // 从localStorage恢复设置
  function initFontFamily() {
    try {
      const stored = localStorage.getItem('cherry-preview-font-family');
      if (stored && (stored === 'monospace' || stored === 'sansSerif')) {
        currentFontFamily.value = stored;
        console.log('[useFontFamily] Restored font family from storage:', currentFontFamily.value);
      }
    } catch (e) {
      console.warn('[useFontFamily] Failed to load font family from storage:', e);
    }
  }

  return {
    currentFontFamily,
    isMonospace,
    FONT_FAMILY_CONFIGS,
    toggleFontFamily,
    setFontFamily,
    initFontFamily,
  };
}
