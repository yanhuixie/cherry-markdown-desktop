<script setup lang="ts">
defineProps<{
  visible: boolean;
  message?: string;
}>();
</script>

<template>
  <Transition name="modal">
    <div v-if="visible" class="modal-overlay">
      <div class="loading-container">
        <!-- 加载动画 -->
        <div class="spinner">
          <div class="spinner-circle"></div>
          <div class="spinner-circle"></div>
          <div class="spinner-circle"></div>
        </div>
        <!-- 提示文字 -->
        <div class="loading-message">
          {{ message || '正在处理...' }}
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
}

.loading-container {
  background-color: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  min-width: 200px;
  padding: 32px 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

/* 加载动画 */
.spinner {
  position: relative;
  width: 50px;
  height: 50px;
}

.spinner-circle {
  position: absolute;
  width: 100%;
  height: 100%;
  border: 4px solid transparent;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1.5s linear infinite;
}

.spinner-circle:nth-child(1) {
  border-top-color: #667eea;
  animation-delay: 0s;
}

.spinner-circle:nth-child(2) {
  width: 70%;
  height: 70%;
  top: 15%;
  left: 15%;
  border-top-color: #764ba2;
  animation-delay: 0.2s;
}

.spinner-circle:nth-child(3) {
  width: 40%;
  height: 40%;
  top: 30%;
  left: 30%;
  border-top-color: #f093fb;
  animation-delay: 0.4s;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.loading-message {
  font-size: 15px;
  color: #333;
  font-weight: 500;
  text-align: center;
}

/* 暗色主题 */
html.dark .loading-container {
  background-color: #2d2d2d;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

html.dark .loading-message {
  color: #d4d4d4;
}

/* 过渡动画 */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s;
}

.modal-enter-active .loading-container,
.modal-leave-active .loading-container {
  transition: transform 0.2s, opacity 0.2s;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .loading-container,
.modal-leave-to .loading-container {
  transform: scale(0.95);
  opacity: 0;
}
</style>
