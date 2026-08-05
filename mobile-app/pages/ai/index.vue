<template>
  <view class="page-shell">
    <view class="status-space" />
    <view class="topbar">
      <view>
        <text class="kicker">LUMINO AI</text>
        <text class="page-title">创作工作台</text>
      </view>
      <view class="top-mark">✦</view>
    </view>

    <scroll-view class="page-scroll" scroll-y>
      <view class="content">
        <view class="welcome-card">
          <text class="welcome-kicker">YOUR CREATIVE COMPANION</text>
          <text class="welcome-title">把想法交给 AI，<text class="accent">把故事留在 Lumino。</text></text>
          <text class="welcome-copy">可以先聊天梳理思路，也可以上传图片、Word 或 PDF，让 AI 帮你整理成博客或空间文章。</text>
        </view>

        <view class="action-grid">
          <view class="action-card action-primary" @tap="startChat">
            <text class="action-icon">◌</text>
            <text class="action-title">和 AI 聊聊</text>
            <text class="action-copy">继续一个灵感，或从零开始</text>
            <text class="action-arrow">→</text>
          </view>
          <view class="action-card action-secondary" @tap="startCreate">
            <text class="action-icon">＋</text>
            <text class="action-title">多模态创作</text>
            <text class="action-copy">文字、图片、Word、PDF</text>
            <text class="action-arrow">→</text>
          </view>
        </view>

        <view class="section-heading">
          <view>
            <text class="section-kicker">AVAILABLE NOW</text>
            <text class="section-title">你的权限</text>
          </view>
        </view>
        <view class="permission-card">
          <view class="permission-row">
            <text>AI 对话与生成</text>
            <text class="permission-on">已开启</text>
          </view>
          <view class="permission-row">
            <text>发布公开博客</text>
            <text :class="permissionClass(capabilities.can_publish_blog)">{{ capabilityLabel(capabilities.can_publish_blog) }}</text>
          </view>
          <view class="permission-row">
            <text>MCP 发布</text>
            <text :class="permissionClass(capabilities.can_mcp_publish)">{{ capabilityLabel(capabilities.can_mcp_publish) }}</text>
          </view>
          <text v-if="capabilities.can_mcp_publish" class="permission-note">MCP 由后端托管，客户端不会保存长期令牌。</text>
          <text v-else class="permission-note">如需 MCP 发布权限，请联系管理员开启。</text>
        </view>

        <view class="history-card">
          <view>
            <text class="section-kicker">RECENT WORK</text>
            <text class="history-title">最近的创作会显示在这里</text>
          </view>
          <text class="history-copy">草稿、解析任务和发布记录统一由后端保存，之后可在 Web 端继续编辑。</text>
        </view>
      </view>
    </scroll-view>

    <view class="bottom-nav safe-bottom">
      <view class="bottom-nav-item" @tap="go('/pages/index/index')"><text class="nav-icon">⌂</text><text>前厅</text></view>
      <view class="bottom-nav-item active"><text class="nav-icon">✦</text><text>AI</text></view>
      <view class="bottom-nav-item" @tap="go('/pages/spaces/index')"><text class="nav-icon">◇</text><text>空间</text></view>
      <view class="bottom-nav-item" @tap="go('/pages/account/index')"><text class="nav-icon">○</text><text>我的</text></view>
    </view>
  </view>
</template>

<script>
import { getCapabilities } from '../../services/api'

export default {
  data() {
    return {
      capabilities: {
        can_publish_blog: false,
        can_mcp_publish: false,
      },
    }
  },
  onLoad() {
    this.loadCapabilities()
  },
  methods: {
    async loadCapabilities() {
      try {
        this.capabilities = { ...this.capabilities, ...(await getCapabilities()) }
      } catch (error) {
        this.capabilities = { ...this.capabilities }
      }
    },
    capabilityLabel(value) {
      if (value) return '已开启'
      return '未开启'
    },
    permissionClass(value) {
      if (value) return 'permission-on'
      return 'permission-off'
    },
    startChat() {
      uni.showToast({ title: 'AI 对话将在下一阶段接入', icon: 'none' })
    },
    startCreate() {
      uni.showToast({ title: '多模态创作将在下一阶段接入', icon: 'none' })
    },
    go(url) {
      uni.navigateTo({ url })
    },
  },
}
</script>

<style scoped>
.page-shell { height: 100vh; overflow: hidden; background: #f1eee5; }
.status-space { height: var(--status-bar-height); background: rgba(248, 246, 240, 0.95); }
.topbar { height: 116rpx; padding: 18rpx 32rpx; display: flex; align-items: center; justify-content: space-between; background: rgba(248, 246, 240, 0.95); border-bottom: 1rpx solid rgba(23, 33, 29, 0.08); }
.kicker, .section-kicker, .welcome-kicker { display: block; color: #9b611f; font-size: 17rpx; font-weight: 800; letter-spacing: 4rpx; }
.page-title { display: block; margin-top: 10rpx; font-family: Georgia, 'Songti SC', serif; font-size: 42rpx; font-weight: 700; }
.top-mark { width: 68rpx; height: 68rpx; display: flex; align-items: center; justify-content: center; border-radius: 22rpx; color: #f7b84b; background: #163a2b; font-size: 34rpx; }
.page-scroll { height: calc(100vh - var(--status-bar-height) - 116rpx - 126rpx); }
.content { padding: 28rpx 28rpx 56rpx; }
.welcome-card { padding: 34rpx; border-radius: 40rpx; color: #fff; background: #163a2b; box-shadow: 0 28rpx 56rpx rgba(22, 58, 43, 0.16); }
.welcome-kicker { color: #f7b84b; }
.welcome-title { display: block; margin-top: 26rpx; font-family: Georgia, 'Songti SC', serif; font-size: 43rpx; font-weight: 700; line-height: 60rpx; }
.accent { color: #f7b84b; }
.welcome-copy { display: block; margin-top: 22rpx; color: rgba(255, 255, 255, 0.66); font-size: 24rpx; line-height: 40rpx; }
.action-grid { margin-top: 20rpx; display: grid; grid-template-columns: 1fr 1fr; gap: 16rpx; }
.action-card { position: relative; min-height: 218rpx; padding: 24rpx; border-radius: 32rpx; overflow: hidden; }
.action-primary { color: #fff; background: #25543f; }
.action-secondary { color: #17211d; background: #f4d8a4; }
.action-icon { display: block; font-size: 36rpx; }
.action-title { display: block; margin-top: 28rpx; font-family: Georgia, 'Songti SC', serif; font-size: 30rpx; font-weight: 700; }
.action-copy { display: block; margin-top: 10rpx; font-size: 19rpx; line-height: 29rpx; opacity: 0.64; }
.action-arrow { position: absolute; right: 22rpx; bottom: 20rpx; font-size: 30rpx; }
.section-heading { margin-top: 54rpx; padding: 0 4rpx 22rpx; border-bottom: 1rpx solid rgba(23, 33, 29, 0.1); }
.section-title { display: block; margin-top: 10rpx; font-family: Georgia, 'Songti SC', serif; font-size: 40rpx; font-weight: 700; }
.permission-card, .history-card { margin-top: 18rpx; padding: 10rpx 24rpx; border: 1rpx solid rgba(23, 33, 29, 0.08); border-radius: 30rpx; background: rgba(255, 253, 248, 0.84); }
.permission-row { min-height: 76rpx; display: flex; align-items: center; justify-content: space-between; border-bottom: 1rpx solid rgba(23, 33, 29, 0.07); font-size: 23rpx; }
.permission-row:last-of-type { border-bottom: none; }
.permission-on { color: #1d6347; font-weight: 700; }
.permission-off { color: rgba(23, 33, 29, 0.38); }
.permission-note, .history-copy { display: block; padding: 16rpx 0 18rpx; color: rgba(23, 33, 29, 0.46); font-size: 20rpx; line-height: 31rpx; }
.history-card { margin-top: 24rpx; padding: 26rpx 24rpx; }
.history-title { display: block; margin-top: 12rpx; font-family: Georgia, 'Songti SC', serif; font-size: 29rpx; font-weight: 700; }
.bottom-nav { height: 126rpx; display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1rpx solid rgba(23, 33, 29, 0.09); background: rgba(255, 253, 248, 0.97); box-shadow: 0 -16rpx 42rpx rgba(23, 33, 29, 0.06); }
.bottom-nav-item { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7rpx; color: rgba(23, 33, 29, 0.42); font-size: 19rpx; font-weight: 700; }
.bottom-nav-item.active { color: #163a2b; }
.bottom-nav-item.active::before { content: ''; position: absolute; top: 9rpx; width: 44rpx; height: 5rpx; border-radius: 999rpx; background: #f7b84b; }
.nav-icon { font-size: 32rpx; line-height: 34rpx; }
.safe-bottom { padding-bottom: constant(safe-area-inset-bottom); padding-bottom: env(safe-area-inset-bottom); }
</style>
