<script setup lang="ts">
defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="modal-overlay" @click.self="emit('close')">
        <div class="modal-content">
          <div class="modal-header">
            <h2>关于 Cherry Markdown Desktop</h2>
            <button class="close-btn" @click="emit('close')">&times;</button>
          </div>
          <div class="modal-body">
            <div class="about-section">
              <p class="about-title">Cherry Markdown Desktop</p>
              <p class="about-version">版本 0.1.1</p>
            </div>

            <div class="about-section">
              <p class="about-description">
                本程序是基于腾讯 <strong>Cherry Markdown</strong> 项目构建的桌面版 Markdown 编辑器，
                采用 Tauri 2.x + Vue 3 构建，因开发环境限制，目前只支持Windows 10/11。
                感谢腾讯开源了强大的 <strong>Cherry Markdown</strong> 项目。
              </p>
            </div>

            <div class="about-section">
              <p class="about-links">
                <a href="https://github.com/Tencent/cherry-markdown" target="_blank" rel="noopener">
                  Cherry Markdown GitHub
                </a> <span style="color: aliceblue;">, </span>
                <a href="https://github.com/yanhuixie/cherry-markdown-desktop" target="_blank" rel="noopener">
                  Cherry Markdown Desktop GitHub
                </a>
              </p>
            </div>

            <!-- <div class="about-section qrcode-section">
              <p class="qrcode-title">欢迎关注微信公众号</p>
              <img src="/wechat-mp.jpg" alt="微信公众号二维码" class="qrcode-img" />
            </div> -->
            <br/>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  max-width: 480px;
  width: 90%;
  max-height: 80vh;
  overflow: auto;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e5e5;
}

.modal-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #999;
  cursor: pointer;
  padding: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.close-btn:hover {
  background-color: #f0f0f0;
  color: #333;
}

.modal-body {
  padding: 20px;
}

.about-section {
  margin-bottom: 20px;
}

.about-section:last-child {
  margin-bottom: 0;
}

.about-title {
  font-size: 20px;
  font-weight: 600;
  color: #333;
  margin: 0 0 4px 0;
}

.about-version {
  font-size: 13px;
  color: #666;
  margin: 0;
}

.about-description {
  font-size: 14px;
  line-height: 1.6;
  color: #555;
  margin: 0;
}

.about-description strong {
  color: #333;
}

.about-links a {
  color: #1890ff;
  text-decoration: none;
  font-size: 14px;
}

.about-links a:hover {
  text-decoration: underline;
}

.qrcode-section {
  text-align: center;
  padding-top: 12px;
  border-top: 1px solid #e5e5e5;
}

.qrcode-title {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  margin: 0 0 12px 0;
}

.qrcode-img {
  width: 200px;
  height: 200px;
  object-fit: contain;
}

/* 暗色主题 */
html.dark .modal-content {
  background-color: #2d2d2d;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
}

html.dark .modal-header {
  border-bottom-color: #3e3e3e;
}

html.dark .modal-header h2 {
  color: #d4d4d4;
}

html.dark .close-btn {
  color: #8a8a8a;
}

html.dark .close-btn:hover {
  background-color: #3e3e3e;
  color: #d4d4d4;
}

html.dark .about-title {
  color: #d4d4d4;
}

html.dark .about-version {
  color: #8a8a8a;
}

html.dark .about-description {
  color: #a0a0a0;
}

html.dark .about-description strong {
  color: #d4d4d4;
}

html.dark .about-links a {
  color: #40a9ff;
}

html.dark .qrcode-section {
  border-top-color: #3e3e3e;
}

html.dark .qrcode-title {
  color: #d4d4d4;
}

/* 过渡动画 */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition: transform 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  transform: scale(0.95);
}
</style>
