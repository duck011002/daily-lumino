<template>
  <view class="page-shell">
    <view class="status-space" />
    <view class="topbar">
      <view>
        <text class="kicker">PRIVATE COURTYARD</text>
        <text class="page-title">内院</text>
      </view>
      <view class="top-mark" @tap="createSpace">＋</view>
    </view>

    <scroll-view class="page-scroll" scroll-y>
      <view class="content">
        <!-- 待办事项专用大卡片入口 -->
        <view class="todo-hero-card" @tap="openTodos">
          <view class="todo-card-left">
            <view class="todo-badge">
              <text class="todo-icon-glyph">✓</text>
              <text>私人事项</text>
            </view>
            <text class="todo-hero-title">待办与灵感清单</text>
            <text class="todo-hero-copy">记录每日计划、个人待读卡片与私密提醒，仅对当前账号隔离。</text>
          </view>
          <text class="todo-arrow">↗</text>
        </view>

        <view class="section-heading">
          <view>
            <text class="section-kicker">MEMBERSHIPS & SPACES</text>
            <text class="section-title">我的私密空间</text>
          </view>
          <text class="section-count">{{ spaces.length }}</text>
        </view>

        <view v-if="loading" class="empty-card"><text>正在读取空间…</text></view>
        <view v-else-if="!spaces.length" class="empty-card" @tap="goLogin">
          <text class="empty-title">还没有可见空间</text>
          <text class="empty-copy">登录后，你的私密空间会出现在这里。</text>
        </view>
        <view v-else class="space-list">
          <view v-for="space in spaces" :key="space.id" class="space-card" @tap="openSpace(space)">
            <view class="space-symbol">{{ spaceSymbol(space) }}</view>
            <view class="space-copy">
              <text class="space-name">{{ space.name }}</text>
              <text class="space-description">{{ space.description || '记录共同生活与灵感。' }}</text>
              <text class="space-meta">{{ space.type || '个人空间' }}</text>
            </view>
            <text class="space-arrow">›</text>
          </view>
        </view>

        <view class="library-note">
          <text class="library-mark">书</text>
          <view>
            <text class="library-title">书房藏在空间里</text>
            <text class="library-copy">公开书籍、影视和音乐收藏继续与 Web 共用。</text>
          </view>
        </view>
      </view>
    </scroll-view>

    <view class="bottom-nav safe-bottom">
      <view class="bottom-nav-item" @tap="go('/pages/index/index')">
        <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        <text>前厅</text>
      </view>
      <view class="bottom-nav-item" @tap="go('/pages/ai/index')">
        <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/></svg>
        <text>AI</text>
      </view>
      <view class="bottom-nav-item active">
        <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 10v4"/><path d="M17 10v4"/><path d="M12 7v10"/></svg>
        <text>内院</text>
      </view>
      <view class="bottom-nav-item" @tap="go('/pages/account/index')">
        <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <text>我的</text>
      </view>
    </view>
  </view>
</template>

<script>
import { getSpaces } from '../../services/api'

export default {
  data() {
    return { spaces: [], loading: true }
  },
  onLoad() {
    this.loadSpaces()
  },
  methods: {
    async loadSpaces() {
      try {
        const data = await getSpaces()
        if (Array.isArray(data)) this.spaces = data
        if (data && Array.isArray(data.items)) this.spaces = data.items
      } catch (error) {
        this.spaces = []
      } finally {
        this.loading = false
      }
    },
    spaceSymbol(space) {
      if (space.type === 'PERSONAL') return '我'
      if (space.type === 'COUPLE') return '共'
      return '◇'
    },
    openSpace(space) {
      uni.navigateTo({ url: '/pages/space-detail/index?id=' + space.id })
    },
    openTodos() {
      uni.navigateTo({ url: '/pages/todos/index' })
    },
    createSpace() {
      uni.navigateTo({ url: '/pages/space-create/index' })
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
.top-mark { width: 68rpx; height: 68rpx; display: flex; align-items: center; justify-content: center; border-radius: 22rpx; color: #f7b84b; background: #163a2b; font-size: 34rpx; }
.page-scroll { height: calc(100vh - var(--status-bar-height) - 116rpx - 126rpx); }
.content { padding: 28rpx 28rpx 56rpx; }

.todo-hero-card {
  position: relative;
  padding: 34rpx 36rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-radius: 40rpx;
  color: #ffffff;
  background: #163a2b;
  box-shadow: 0 24rpx 54rpx rgba(22, 58, 43, 0.18);
}
.todo-card-left { min-width: 0; flex: 1; pr: 20rpx; }
.todo-badge { display: inline-flex; align-items: center; gap: 8rpx; padding: 6rpx 16rpx; border-radius: 999rpx; color: #17211d; background: #f7b84b; font-size: 19rpx; font-weight: 700; }
.todo-icon-glyph { font-weight: 900; }
.todo-hero-title { display: block; margin-top: 18rpx; font-family: Georgia, 'Songti SC', serif; font-size: 36rpx; font-weight: 700; color: #ffffff; }
.todo-hero-copy { display: block; margin-top: 12rpx; color: rgba(255, 255, 255, 0.64); font-size: 22rpx; line-height: 36rpx; }
.todo-arrow { color: #f7b84b; font-size: 40rpx; font-weight: 700; }

.intro-card { padding: 34rpx; border-radius: 40rpx; background: #e4ecdf; }
.intro-title { display: block; color: #163a2b; font-family: Georgia, 'Songti SC', serif; font-size: 38rpx; font-weight: 700; line-height: 54rpx; }
.intro-copy { display: block; margin-top: 18rpx; color: rgba(23, 33, 29, 0.57); font-size: 23rpx; line-height: 38rpx; }
.section-heading { margin-top: 48rpx; padding: 0 4rpx 22rpx; display: flex; align-items: flex-end; justify-content: space-between; border-bottom: 1rpx solid rgba(23, 33, 29, 0.1); }
.section-title { display: block; margin-top: 10rpx; font-family: Georgia, 'Songti SC', serif; font-size: 40rpx; font-weight: 700; }
.section-count { color: rgba(23, 33, 29, 0.35); font-family: Georgia, serif; font-size: 34rpx; }
.empty-card { min-height: 230rpx; margin-top: 18rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 1rpx solid rgba(23, 33, 29, 0.08); border-radius: 30rpx; color: rgba(23, 33, 29, 0.48); background: rgba(255, 253, 248, 0.84); font-size: 22rpx; }
.empty-title { color: #17211d; font-family: Georgia, 'Songti SC', serif; font-size: 31rpx; font-weight: 700; }
.empty-copy { margin-top: 12rpx; }
.space-list { margin-top: 18rpx; }
.space-card { min-height: 148rpx; padding: 22rpx; display: flex; align-items: center; gap: 20rpx; border: 1rpx solid rgba(23, 33, 29, 0.08); border-radius: 30rpx; background: rgba(255, 253, 248, 0.84); }
.space-card + .space-card { margin-top: 14rpx; }
.space-symbol { width: 78rpx; height: 78rpx; flex: none; display: flex; align-items: center; justify-content: center; border-radius: 26rpx; color: #f7b84b; background: #163a2b; font-family: Georgia, 'Songti SC', serif; font-size: 32rpx; font-weight: 700; }
.space-copy { min-width: 0; flex: 1; }
.space-name, .space-description, .space-meta { display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.space-name { font-family: Georgia, 'Songti SC', serif; font-size: 29rpx; font-weight: 700; }
.space-description { margin-top: 8rpx; color: rgba(23, 33, 29, 0.5); font-size: 20rpx; }
.space-meta { margin-top: 8rpx; color: #9b611f; font-size: 17rpx; font-weight: 700; }
.space-arrow { color: rgba(23, 33, 29, 0.3); font-size: 40rpx; }
.library-note { margin-top: 26rpx; padding: 22rpx; display: flex; align-items: center; gap: 18rpx; border-radius: 28rpx; background: #f4d8a4; }
.library-mark { width: 58rpx; height: 58rpx; display: flex; align-items: center; justify-content: center; border-radius: 19rpx; color: #f7b84b; background: #163a2b; font-family: Georgia, 'Songti SC', serif; font-size: 25rpx; font-weight: 700; }
.library-title, .library-copy { display: block; }
.library-title { font-family: Georgia, 'Songti SC', serif; font-size: 25rpx; font-weight: 700; }
.library-copy { margin-top: 7rpx; color: rgba(23, 33, 29, 0.52); font-size: 19rpx; }
.bottom-nav { height: 126rpx; display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1rpx solid rgba(23, 33, 29, 0.09); background: rgba(255, 253, 248, 0.97); box-shadow: 0 -16rpx 42rpx rgba(23, 33, 29, 0.06); }
.bottom-nav-item { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6rpx; color: rgba(23, 33, 29, 0.45); font-size: 20rpx; font-weight: 700; }
.bottom-nav-item.active { color: #163a2b; }
.bottom-nav-item.active::before { content: ''; position: absolute; top: 8rpx; width: 44rpx; height: 5rpx; border-radius: 999rpx; background: #f7b84b; }
.svg-icon { width: 42rpx; height: 42rpx; stroke: currentColor; }
.bottom-nav-item.active .svg-icon { stroke: #163a2b; }
.safe-bottom { padding-bottom: constant(safe-area-inset-bottom); padding-bottom: env(safe-area-inset-bottom); }
</style>
