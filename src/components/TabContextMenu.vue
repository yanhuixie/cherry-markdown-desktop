<script setup lang="ts">
defineProps<{
  visible: boolean;
  x: number;
  y: number;
  tabIndex: number;
  totalTabs: number;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'close-left'): void;
  (e: 'close-right'): void;
  (e: 'close-all'): void;
}>();
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="tab-context-menu"
      :style="{ left: x + 'px', top: y + 'px' }"
      @click.stop
    >
      <div class="menu-item" @click="emit('close')">
        关闭当前标签页
      </div>
      <div
        v-if="tabIndex > 0"
        class="menu-item"
        @click="emit('close-left')"
      >
        关闭左侧标签页
      </div>
      <div
        v-if="tabIndex < totalTabs - 1"
        class="menu-item"
        @click="emit('close-right')"
      >
        关闭右侧标签页
      </div>
      <div class="menu-item" @click="emit('close-all')">
        关闭所有标签页
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.tab-context-menu {
  position: fixed;
  background-color: #f0f0f0;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 9999;
  min-width: 150px;
  padding: 4px 0;
}

.menu-item {
  padding: 8px 16px;
  cursor: pointer;
  font-size: 13px;
  color: #333;
  user-select: none;
}

.menu-item:hover {
  background-color: #396cd8;
  color: #fff;
}

/* 暗色主题 */
html.dark .tab-context-menu {
  background-color: #252526;
  border-color: #3e3e3e;
}

html.dark .menu-item {
  color: #d4d4d4;
}

html.dark .menu-item:hover {
  background-color: #396cd8;
  color: #fff;
}
</style>
