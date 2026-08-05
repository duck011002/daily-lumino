<template>
  <view class="page-shell">
    <view class="status-space" />
    <view class="topbar">
      <view>
        <text class="kicker">PERSONAL DESK</text>
        <text class="page-title">我的</text>
      </view>
      <view class="top-mark">○</view>
    </view>

    <scroll-view class="page-scroll" scroll-y>
      <view class="content">
        <view v-if="!isLoggedIn" class="login-card" @tap="goLogin">
          <view class="avatar">L</view>
          <view class="profile-copy">
            <text class="profile-name">登录 Lumino</text>
            <text class="profile-email">登录后查看权限、空间和 AI 草稿</text>
          </view>
          <text class="login-arrow">→</text>
        </view>
        <view v-else class="profile-card">
          <view class="avatar">{{ avatarLetter }}</view>
          <view class="profile-copy">
            <text class="profile-name">{{ user.display_name || user.username || 'Lumino 用户' }}</text>
            <text class="profile-email">{{ user.email || '登录后同步你的空间与草稿' }}</text>
          </view>
        </view>

        <view class="section-heading">
          <view>
            <text class="section-kicker">ACCOUNT STATUS</text>
            <text class="section-title">使用权限</text>
          </view>
        </view>
        <view v-if="isLoggedIn" class="status-card">
          <view class="status-row"><text>博客编辑</text><text :class="permissionClass(canPublishBlog)">{{ permissionLabel(canPublishBlog) }}</text></view>
          <view class="status-row"><text>空间协作</text><text :class="permissionClass(user.can_create_spaces)">{{ permissionLabel(user.can_create_spaces) }}</text></view>
          <view class="status-row"><text>AI / MCP 发布</text><text :class="permissionClass(canMcpPublish)">{{ permissionLabel(canMcpPublish) }}</text></view>
        </view>

        <view v-if="isLoggedIn" class="tip-card">
          <text class="tip-mark">✦</text>
          <view>
            <text class="tip-title">内容会和 Web 自动同步</text>
            <text class="tip-copy">博客进入公开博客，空间文章进入对应空间；权限由后端统一控制。</text>
          </view>
        </view>

        <view class="account-actions">
          <view v-if="isLoggedIn && canPublishBlog" class="account-action" @tap="openBlogManager"><text>{{ user.is_root ? '全站博客管理' : '我的博客' }}</text><text>›</text></view>
          <view v-if="isLoggedIn" class="account-action" @tap="showProfile"><text>个人资料</text><text>›</text></view>
          <view v-if="isLoggedIn" class="account-action" @tap="logout"><text>退出登录</text><text>›</text></view>
          <view v-else class="account-action" @tap="goLogin"><text>去登录</text><text>›</text></view>
        </view>
      </view>
    </scroll-view>

    <view class="bottom-nav safe-bottom">
      <view class="bottom-nav-item" @tap="go('/pages/index/index')"><text class="nav-icon">⌂</text><text>前厅</text></view>
      <view class="bottom-nav-item" @tap="go('/pages/ai/index')"><text class="nav-icon">✦</text><text>AI</text></view>
      <view class="bottom-nav-item" @tap="go('/pages/spaces/index')"><text class="nav-icon">◇</text><text>空间</text></view>
      <view class="bottom-nav-item active"><text class="nav-icon">○</text><text>我的</text></view>
    </view>
  </view>
</template>

<script>
import { clearLogin, getCapabilities, getCurrentUser } from '../../services/api'

export default {
  data() {
    return {
      user: {
        display_name: '',
        username: '',
        email: '',
        can_write_blog: false,
        can_create_spaces: false,
        can_use_mcp: false,
      },
      capabilities: {
        can_publish_blog: false,
        can_mcp_publish: false,
      },
    }
  },
  computed: {
    isLoggedIn() {
      return Boolean(uni.getStorageSync('lumino_access_token')) && Boolean(this.user.username)
    },
    avatarLetter() {
      const name = this.user.display_name || this.user.username || 'L'
      return String(name).slice(0, 1).toUpperCase()
    },
    canPublishBlog() {
      return Boolean(this.user.is_root || this.capabilities.can_publish_blog)
    },
    canMcpPublish() {
      return Boolean(this.user.is_root || this.capabilities.can_mcp_publish)
    },
  },
  onLoad() {
    this.loadUser()
  },
  methods: {
    async loadUser() {
      if (!uni.getStorageSync('lumino_access_token')) return
      try {
        this.user = { ...this.user, ...(await getCurrentUser()) }
      } catch (error) {
        uni.showToast({ title: '请先在 Web 端登录', icon: 'none' })
        return
      }
      try {
        this.capabilities = { ...this.capabilities, ...(await getCapabilities()) }
      } catch (error) {
        // 用户信息已成功加载时，超级管理员仍可由 is_root 正确展示其有效权限。
      }
    },
    permissionLabel(value) {
      if (value) return '已开启'
      return '未开启'
    },
    permissionClass(value) {
      if (value) return 'permission-on'
      return 'permission-off'
    },
    showProfile() {
      uni.showToast({ title: '个人资料编辑将在下一阶段接入', icon: 'none' })
    },
    openBlogManager() {
      uni.navigateTo({ url: '/pages/my-blog/index' })
    },
    logout() {
      clearLogin().finally(() => {
        this.user = { ...this.user, username: '', email: '', display_name: '' }
        uni.showToast({ title: '已退出登录', icon: 'success' })
      })
    },
    goLogin() {
      uni.navigateTo({ url: '/pages/login/index' })
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
.kicker, .section-kicker { display: block; color: #9b611f; font-size: 17rpx; font-weight: 800; letter-spacing: 4rpx; }
.page-title { display: block; margin-top: 10rpx; font-family: Georgia, 'Songti SC', serif; font-size: 42rpx; font-weight: 700; }
.top-mark { width: 68rpx; height: 68rpx; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: #f7b84b; background: #163a2b; font-size: 38rpx; }
.page-scroll { height: calc(100vh - var(--status-bar-height) - 116rpx - 126rpx); }
.content { padding: 28rpx 28rpx 56rpx; }
.profile-card { padding: 30rpx; display: flex; align-items: center; gap: 22rpx; border-radius: 38rpx; color: #fff; background: #163a2b; box-shadow: 0 28rpx 56rpx rgba(22, 58, 43, 0.16); }
.login-card { position: relative; padding: 30rpx; display: flex; align-items: center; gap: 22rpx; border-radius: 38rpx; color: #17211d; background: #f4d8a4; }
.login-arrow { margin-left: auto; color: #9b611f; font-size: 34rpx; }
.avatar { width: 92rpx; height: 92rpx; flex: none; display: flex; align-items: center; justify-content: center; border-radius: 30rpx; color: #f7b84b; background: rgba(255, 255, 255, 0.12); font-family: Georgia, serif; font-size: 40rpx; font-weight: 700; }
.profile-copy { min-width: 0; }
.profile-name, .profile-email { display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.profile-name { font-family: Georgia, 'Songti SC', serif; font-size: 34rpx; font-weight: 700; }
.profile-email { margin-top: 10rpx; color: rgba(255, 255, 255, 0.57); font-size: 21rpx; }
.section-heading { margin-top: 54rpx; padding: 0 4rpx 22rpx; border-bottom: 1rpx solid rgba(23, 33, 29, 0.1); }
.section-title { display: block; margin-top: 10rpx; font-family: Georgia, 'Songti SC', serif; font-size: 40rpx; font-weight: 700; }
.status-card { margin-top: 18rpx; padding: 8rpx 24rpx; border: 1rpx solid rgba(23, 33, 29, 0.08); border-radius: 30rpx; background: rgba(255, 253, 248, 0.84); }
.status-row { min-height: 76rpx; display: flex; align-items: center; justify-content: space-between; border-bottom: 1rpx solid rgba(23, 33, 29, 0.07); font-size: 23rpx; }
.status-row:last-child { border-bottom: none; }
.permission-on { color: #1d6347; font-weight: 700; }
.permission-off { color: rgba(23, 33, 29, 0.38); }
.tip-card { margin-top: 24rpx; padding: 22rpx; display: flex; gap: 17rpx; border-radius: 28rpx; background: #f4d8a4; }
.tip-mark { color: #9b611f; font-size: 31rpx; }
.tip-title, .tip-copy { display: block; }
.tip-title { font-family: Georgia, 'Songti SC', serif; font-size: 25rpx; font-weight: 700; }
.tip-copy { margin-top: 8rpx; color: rgba(23, 33, 29, 0.54); font-size: 19rpx; line-height: 30rpx; }
.account-actions { margin-top: 26rpx; overflow: hidden; border: 1rpx solid rgba(23, 33, 29, 0.08); border-radius: 30rpx; background: rgba(255, 253, 248, 0.84); }
.account-action { min-height: 78rpx; padding: 0 24rpx; display: flex; align-items: center; justify-content: space-between; border-bottom: 1rpx solid rgba(23, 33, 29, 0.07); font-size: 23rpx; }
.account-action:last-child { border-bottom: none; }
.account-action text:last-child { color: rgba(23, 33, 29, 0.28); font-size: 38rpx; }
.bottom-nav { height: 126rpx; display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1rpx solid rgba(23, 33, 29, 0.09); background: rgba(255, 253, 248, 0.97); box-shadow: 0 -16rpx 42rpx rgba(23, 33, 29, 0.06); }
.bottom-nav-item { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7rpx; color: rgba(23, 33, 29, 0.42); font-size: 19rpx; font-weight: 700; }
.bottom-nav-item.active { color: #163a2b; }
.bottom-nav-item.active::before { content: ''; position: absolute; top: 9rpx; width: 44rpx; height: 5rpx; border-radius: 999rpx; background: #f7b84b; }
.nav-icon { font-size: 32rpx; line-height: 34rpx; }
.safe-bottom { padding-bottom: constant(safe-area-inset-bottom); padding-bottom: env(safe-area-inset-bottom); }
</style>
