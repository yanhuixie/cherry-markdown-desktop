import { ref } from 'vue';

// 全局状态：是否展开所有代码块
const allCodeExpanded = ref(false);

export function useCodeBlock() {
  // 切换代码块展开状态
  function toggleCodeBlock() {
    allCodeExpanded.value = !allCodeExpanded.value;
    // 触发自定义事件通知 CherryEditor
    window.dispatchEvent(new CustomEvent('toggle-code-block', {
      detail: { expanded: allCodeExpanded.value }
    }));
  }

  // 展开所有代码块
  function expandAllCodeBlocks() {
    allCodeExpanded.value = true;
    window.dispatchEvent(new CustomEvent('toggle-code-block', {
      detail: { expanded: true }
    }));
  }

  // 折叠所有代码块
  function collapseAllCodeBlocks() {
    allCodeExpanded.value = false;
    window.dispatchEvent(new CustomEvent('toggle-code-block', {
      detail: { expanded: false }
    }));
  }

  return {
    allCodeExpanded,
    toggleCodeBlock,
    expandAllCodeBlocks,
    collapseAllCodeBlocks
  };
}
