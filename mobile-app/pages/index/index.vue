<template>
  <view class="app-shell">
    <view class="status-space" />

    <view class="topbar">
      <view class="brand">
        <view class="brand-mark">L</view>
        <view>
          <text class="brand-name">Lumino</text>
          <text class="brand-caption">DIGITAL GARDEN</text>
        </view>
      </view>
      <view class="top-actions">
        <view class="round-button" @tap="showComingSoon('搜索')">⌕</view>
        <view class="avatar-mini" @tap="openAccount">
          <image v-if="avatarUrl" :src="avatarUrl" mode="aspectFill" />
          <text v-else>{{ avatarLetter }}</text>
        </view>
      </view>
    </view>

    <scroll-view
      class="content-scroll"
      scroll-y
      refresher-enabled
      :refresher-triggered="refreshing"
      @refresherrefresh="refresh"
    >
      <view class="content">
        <view class="hero-card">
          <image v-if="coverUrl" class="hero-cover" :src="coverUrl" mode="aspectFill" />
          <view class="hero-orbit hero-orbit-large" />
          <view class="hero-orbit hero-orbit-small" />
          <view class="hero-shade" />

          <view class="hero-content">
            <view class="eyebrow-row">
              <text class="eyebrow">WELCOME HOME</text>
              <text class="live-pill">前厅</text>
            </view>
            <text class="hello">你好，我是</text>
            <text class="display-name">{{ profile.display_name }}</text>
            <text class="headline">{{ profile.headline }}</text>
            <text class="bio">{{ profile.bio }}</text>
            <view v-if="profile.status_text" class="status-line">
              <view class="status-dot" />
              <text>{{ profile.status_text }}</text>
            </view>
          </view>
        </view>

        <view class="destination-grid">
          <view
            v-for="item in destinations"
            :key="item.key"
            class="destination-card"
            @tap="openDestination(item)"
          >
            <view class="destination-icon" :class="item.tone">{{ item.icon }}</view>
            <text class="destination-title">{{ item.label }}</text>
            <text class="destination-caption">{{ item.caption }}</text>
            <text class="destination-arrow">↗</text>
          </view>
        </view>

        <view class="section-heading">
          <view>
            <text class="section-kicker">SELECTED WRITING</text>
            <text class="section-title">博客精选</text>
          </view>
          <text class="section-action" @tap="openBlog">查看全部 →</text>
        </view>

        <view v-if="loading" class="loading-card">
          <view class="loading-bar loading-bar-wide" />
          <view class="loading-bar" />
          <view class="loading-bar loading-bar-short" />
        </view>

        <view v-else-if="heroPost" class="featured-card" @tap="openPost(heroPost)">
          <image v-if="heroPostCover" class="featured-cover" :src="heroPostCover" mode="aspectFill" />
          <view class="featured-overlay" />
          <view class="featured-content">
            <view class="tag-row">
              <text class="gold-tag">精选阅读</text>
              <text class="ghost-tag">{{ postCategory(heroPost) }}</text>
            </view>
            <text class="featured-title">{{ heroPost.title }}</text>
            <text class="featured-excerpt">{{ postExcerpt(heroPost) }}</text>
            <view class="featured-meta">
              <text>{{ formatDate(heroPost.published_at) }}</text>
              <text class="read-more">阅读全文 ↗</text>
            </view>
          </view>
        </view>

        <view v-else class="empty-card">
          <text class="empty-title">精选内容正在整理</text>
          <text class="empty-copy">新的技术实践会在这里与你见面。</text>
        </view>

        <view v-if="secondaryPosts.length" class="post-stack">
          <view
            v-for="post in secondaryPosts"
            :key="post.id"
            class="post-row"
            @tap="openPost(post)"
          >
            <image
              v-if="normalizeAssetUrl(post.cover_url)"
              class="post-thumbnail"
              :src="normalizeAssetUrl(post.cover_url)"
              mode="aspectFill"
            />
            <view v-else class="post-thumbnail post-placeholder">L</view>
            <view class="post-copy">
              <text class="post-category">{{ postCategory(post) }}</text>
              <text class="post-title">{{ post.title }}</text>
              <text class="post-date">{{ formatDate(post.published_at) }}</text>
            </view>
            <text class="post-arrow">›</text>
          </view>
        </view>

        <view v-if="favorites.length" class="favorites-block">
          <view class="section-heading section-heading-compact">
            <view>
              <text class="section-kicker">FROM MY SHELVES</text>
              <text class="section-title">最近想与你分享</text>
            </view>
          </view>
          <scroll-view class="favorite-scroll" scroll-x show-scrollbar="false">
            <view class="favorite-track">
              <view v-for="item in favorites" :key="item.id" class="favorite-card">
                <image
                  v-if="normalizeAssetUrl(item.image_url)"
                  class="favorite-image"
                  :src="normalizeAssetUrl(item.image_url)"
                  mode="aspectFill"
                />
                <view v-else class="favorite-image favorite-placeholder">{{ mediaGlyph(item.category) }}</view>
                <text class="favorite-badge">{{ mediaLabel(item) }}</text>
                <text class="favorite-title">{{ item.title }}</text>
                <text v-if="favoriteByline(item)" class="favorite-byline">{{ favoriteByline(item) }}</text>
              </view>
            </view>
          </scroll-view>
        </view>

        <view class="garden-note">
          <text class="garden-note-mark">✦</text>
          <text>一座持续生长的个人数字庭院</text>
        </view>
      </view>
    </scroll-view>

    <view class="bottom-nav safe-bottom">
      <view
        v-for="item in bottomNav"
        :key="item.key"
        class="bottom-nav-item"
        :class="{ active: item.key === 'front' }"
        @tap="openBottomItem(item)"
      >
        <text class="bottom-nav-icon">{{ item.icon }}</text>
        <text>{{ item.label }}</text>
      </view>
    </view>
  </view>
</template>

<script>
import { getHomeData, normalizeAssetUrl } from '../../services/api'

const defaultProfile = {
  display_name: 'Lumino',
  headline: '开发者，也在认真收藏生活',
  bio: '这里是我的个人数字庭院：记录技术实践，也保存阅读、影像与日常片段。',
  avatar_url: '',
  cover_url: '',
  status_text: '',
  status_public: true,
  media_cards: [],
}

export default {
  data() {
    return {
      profile: { ...defaultProfile },
      posts: [],
      loading: true,
      refreshing: false,
      destinations: [
        { key: 'library', label: '书房', caption: '公开收藏与阅读', icon: '书', tone: 'tone-green' },
        { key: 'blog', label: '博客', caption: '文章与技术实践', icon: '文', tone: 'tone-gold' },
        { key: 'todos', label: '待办', caption: '事项与灵感清单', icon: '✓', tone: 'tone-green' },
        { key: 'ai', label: 'AI 创作', caption: '聊天与多模态发布', icon: '✦', tone: 'tone-warm' },
      ],
      bottomNav: [
        { key: 'front', label: '前厅', icon: '⌂' },
        { key: 'ai', label: 'AI', icon: '✦' },
        { key: 'spaces', label: '空间', icon: '◇' },
        { key: 'account', label: '我的', icon: '○' },
      ],
    }
  },
  computed: {
    avatarUrl() {
      return normalizeAssetUrl(this.profile.avatar_url)
    },
    coverUrl() {
      return normalizeAssetUrl(this.profile.cover_url)
    },
    avatarLetter() {
      return String(this.profile.display_name || 'L').slice(0, 1).toUpperCase()
    },
    heroPost() {
      return this.posts[0] || null
    },
    heroPostCover() {
      if (!this.heroPost) return ''
      return normalizeAssetUrl(this.heroPost.cover_url)
    },
    secondaryPosts() {
      return this.posts.slice(1, 4)
    },
    favorites() {
      let cards = []
      if (Array.isArray(this.profile.media_cards)) cards = this.profile.media_cards
      const featured = cards.filter((item) => item.is_featured)
      if (featured.length) return featured.slice(0, 6)
      const categories = ['book', 'movie', 'music']
      return categories
        .map((category) => cards.find((item) => item.category === category))
        .filter(Boolean)
    },
  },
  onLoad() {
    this.loadHome()
  },
  methods: {
    normalizeAssetUrl,
    async loadHome() {
      try {
        const data = await getHomeData()
        if (data.profile) this.profile = { ...defaultProfile, ...data.profile }
        this.posts = []
        if (Array.isArray(data.posts)) this.posts = data.posts
      } finally {
        this.loading = false
        this.refreshing = false
      }
    },
    refresh() {
      this.refreshing = true
      this.loadHome()
    },
    showComingSoon(name) {
      uni.showToast({ title: name + '将在下一阶段接入', icon: 'none' })
    },
    openDestination(item) {
      if (item.key === 'library') {
        uni.navigateTo({ url: '/pages/library/index' })
        return
      }
      if (item.key === 'blog') {
        this.openBlog()
        return
      }
      if (item.key === 'todos') {
        uni.navigateTo({ url: '/pages/todos/index' })
        return
      }
      if (item.key === 'ai') {
        uni.navigateTo({ url: '/pages/ai/index' })
        return
      }
      this.showComingSoon(item.label)
    },
    openBottomItem(item) {
      const routes = {
        front: '/pages/index/index',
        ai: '/pages/ai/index',
        spaces: '/pages/spaces/index',
        account: '/pages/account/index',
      }
      if (item.key === 'front') return
      if (routes[item.key]) uni.navigateTo({ url: routes[item.key] })
    },
    openAccount() {
      uni.navigateTo({ url: '/pages/account/index' })
    },
    openPost(post) {
      if (post && post.slug) uni.navigateTo({ url: '/pages/blog-detail/index?slug=' + encodeURIComponent(post.slug) })
    },
    openBlog() {
      uni.navigateTo({ url: '/pages/blog/index' })
    },
    postCategory(post) {
      if (post.category && post.category.name) return post.category.name
      return '技术实践'
    },
    postExcerpt(post) {
      return post.excerpt || '打开文章，查看完整的实践记录与实现细节。'
    },
    formatDate(value) {
      if (!value) return '近期发布'
      const date = new Date(value)
      return date.getFullYear() + '.' + String(date.getMonth() + 1).padStart(2, '0') + '.' + String(date.getDate()).padStart(2, '0')
    },
    favoriteByline(item) {
      return [item.creator || item.subtitle, item.year].filter(Boolean).join(' · ')
    },
    mediaLabel(item) {
      if (item.badge) return item.badge
      const labels = { book: '书籍', movie: '影视', music: '音乐', status: '生活收藏', other: '收藏' }
      return labels[item.category] || '收藏'
    },
    mediaGlyph(category) {
      const glyphs = { book: '书', movie: '影', music: '乐', status: '记', other: '藏' }
      return glyphs[category] || '藏'
    },
  },
}
</script>

<style scoped>
.app-shell {
  height: 100vh;
  overflow: hidden;
  background:
    radial-gradient(circle at 5% 0%, rgba(255, 255, 255, 0.9), transparent 480rpx),
    #f1eee5;
}

.status-space {
  height: var(--status-bar-height);
  background: rgba(248, 246, 240, 0.94);
}

.topbar {
  height: 116rpx;
  padding: 18rpx 32rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(248, 246, 240, 0.94);
  border-bottom: 1rpx solid rgba(23, 33, 29, 0.08);
}

.brand,
.top-actions,
.eyebrow-row,
.featured-meta,
.tag-row {
  display: flex;
  align-items: center;
}

.brand {
  gap: 16rpx;
}

.brand-mark {
  width: 70rpx;
  height: 70rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 22rpx;
  color: #f7b84b;
  background: #163a2b;
  font-family: Georgia, serif;
  font-size: 38rpx;
  font-weight: 700;
  box-shadow: 0 14rpx 30rpx rgba(22, 58, 43, 0.18);
}

.brand-name,
.brand-caption {
  display: block;
}

.brand-name {
  font-family: Georgia, serif;
  font-size: 34rpx;
  font-weight: 700;
  line-height: 38rpx;
}

.brand-caption {
  margin-top: 4rpx;
  color: rgba(23, 33, 29, 0.42);
  font-size: 16rpx;
  font-weight: 700;
  letter-spacing: 3rpx;
}

.top-actions {
  gap: 14rpx;
}

.round-button,
.avatar-mini {
  width: 68rpx;
  height: 68rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1rpx solid rgba(23, 33, 29, 0.1);
  border-radius: 50%;
  background: rgba(255, 253, 248, 0.8);
  font-size: 36rpx;
  font-weight: 700;
}

.avatar-mini {
  color: #f7b84b;
  background: #163a2b;
  font-family: Georgia, serif;
  font-size: 26rpx;
}

.avatar-mini image {
  width: 100%;
  height: 100%;
}

.content-scroll {
  height: calc(100vh - var(--status-bar-height) - 116rpx - 126rpx);
}

.content {
  padding: 28rpx 28rpx 52rpx;
}

.hero-card {
  position: relative;
  min-height: 590rpx;
  padding: 38rpx;
  overflow: hidden;
  border-radius: 48rpx;
  background: #163a2b;
  box-shadow: 0 34rpx 70rpx rgba(22, 58, 43, 0.2);
}

.hero-cover,
.hero-shade {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.hero-cover {
  opacity: 0.42;
}

.hero-shade {
  background: linear-gradient(180deg, rgba(11, 33, 24, 0.12), rgba(11, 33, 24, 0.96));
}

.hero-orbit {
  position: absolute;
  border: 34rpx solid rgba(247, 184, 75, 0.12);
  border-radius: 50%;
}

.hero-orbit-large {
  width: 320rpx;
  height: 320rpx;
  right: -120rpx;
  top: -130rpx;
}

.hero-orbit-small {
  width: 170rpx;
  height: 170rpx;
  right: 68rpx;
  bottom: -104rpx;
  border-width: 22rpx;
}

.hero-content {
  position: relative;
  z-index: 2;
  min-height: 514rpx;
  display: flex;
  flex-direction: column;
}

.eyebrow-row {
  justify-content: space-between;
}

.eyebrow {
  color: #f7b84b;
  font-size: 18rpx;
  font-weight: 800;
  letter-spacing: 5rpx;
}

.live-pill {
  padding: 8rpx 18rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.18);
  border-radius: 999rpx;
  color: rgba(255, 255, 255, 0.68);
  background: rgba(255, 255, 255, 0.07);
  font-size: 20rpx;
}

.hello {
  margin-top: 84rpx;
  color: rgba(255, 255, 255, 0.58);
  font-size: 25rpx;
  font-weight: 600;
}

.display-name {
  margin-top: 10rpx;
  color: #ffffff;
  font-family: Georgia, "Songti SC", serif;
  font-size: 72rpx;
  font-weight: 700;
  line-height: 82rpx;
}

.headline {
  margin-top: 24rpx;
  color: rgba(255, 255, 255, 0.94);
  font-family: Georgia, "Songti SC", serif;
  font-size: 35rpx;
  font-weight: 600;
  line-height: 50rpx;
}

.bio {
  margin-top: 22rpx;
  padding-left: 22rpx;
  border-left: 3rpx solid rgba(247, 184, 75, 0.58);
  color: rgba(255, 255, 255, 0.66);
  font-size: 25rpx;
  line-height: 42rpx;
}

.status-line {
  margin-top: auto;
  padding-top: 22rpx;
  display: flex;
  align-items: center;
  gap: 12rpx;
  color: rgba(255, 255, 255, 0.58);
  font-size: 22rpx;
}

.status-dot {
  width: 13rpx;
  height: 13rpx;
  border-radius: 50%;
  background: #f7b84b;
  box-shadow: 0 0 0 7rpx rgba(247, 184, 75, 0.12);
}

.destination-grid {
  margin-top: 24rpx;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
}

.destination-card {
  position: relative;
  min-width: 0;
  padding: 24rpx 18rpx 22rpx;
  overflow: hidden;
  border: 1rpx solid rgba(23, 33, 29, 0.09);
  border-radius: 32rpx;
  background: rgba(255, 253, 248, 0.84);
}

.destination-icon {
  width: 66rpx;
  height: 66rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 21rpx;
  font-family: Georgia, "Songti SC", serif;
  font-size: 25rpx;
  font-weight: 700;
}

.tone-green {
  color: #f7b84b;
  background: #163a2b;
}

.tone-gold {
  color: #71430e;
  background: #f4d8a4;
}

.tone-warm {
  color: #7a5038;
  background: #ead8ca;
}

.destination-title,
.destination-caption {
  display: block;
}

.destination-title {
  margin-top: 20rpx;
  font-family: Georgia, "Songti SC", serif;
  font-size: 28rpx;
  font-weight: 700;
}

.destination-caption {
  margin-top: 8rpx;
  overflow: hidden;
  color: rgba(23, 33, 29, 0.45);
  font-size: 19rpx;
  line-height: 29rpx;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.destination-arrow {
  position: absolute;
  right: 18rpx;
  top: 24rpx;
  color: rgba(23, 33, 29, 0.28);
  font-size: 24rpx;
}

.section-heading {
  margin-top: 66rpx;
  padding: 0 4rpx 24rpx;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  border-bottom: 1rpx solid rgba(23, 33, 29, 0.1);
}

.section-heading-compact {
  margin-top: 0;
}

.section-kicker,
.section-title {
  display: block;
}

.section-kicker {
  color: #9b611f;
  font-size: 17rpx;
  font-weight: 800;
  letter-spacing: 4rpx;
}

.section-title {
  margin-top: 12rpx;
  font-family: Georgia, "Songti SC", serif;
  font-size: 44rpx;
  font-weight: 700;
}

.section-action {
  padding-bottom: 5rpx;
  color: #1d6347;
  font-size: 23rpx;
  font-weight: 700;
}

.featured-card,
.loading-card,
.empty-card {
  position: relative;
  min-height: 470rpx;
  margin-top: 24rpx;
  padding: 34rpx;
  overflow: hidden;
  border-radius: 40rpx;
  background: #163a2b;
  box-shadow: 0 28rpx 54rpx rgba(22, 58, 43, 0.16);
}

.featured-cover,
.featured-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.featured-overlay {
  background: linear-gradient(180deg, rgba(11, 33, 24, 0.05), rgba(11, 33, 24, 0.96));
}

.featured-content {
  position: absolute;
  z-index: 2;
  right: 34rpx;
  bottom: 32rpx;
  left: 34rpx;
}

.tag-row {
  gap: 12rpx;
}

.gold-tag,
.ghost-tag {
  padding: 8rpx 18rpx;
  border-radius: 999rpx;
  font-size: 19rpx;
  font-weight: 700;
}

.gold-tag {
  color: #17211d;
  background: #f7b84b;
}

.ghost-tag {
  color: rgba(255, 255, 255, 0.82);
  border: 1rpx solid rgba(255, 255, 255, 0.22);
  background: rgba(255, 255, 255, 0.08);
}

.featured-title,
.featured-excerpt {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
}

.featured-title {
  margin-top: 24rpx;
  color: #ffffff;
  font-family: Georgia, "Songti SC", serif;
  font-size: 39rpx;
  font-weight: 700;
  line-height: 52rpx;
  -webkit-line-clamp: 2;
}

.featured-excerpt {
  margin-top: 16rpx;
  color: rgba(255, 255, 255, 0.62);
  font-size: 23rpx;
  line-height: 37rpx;
  -webkit-line-clamp: 2;
}

.featured-meta {
  margin-top: 24rpx;
  justify-content: space-between;
  color: rgba(255, 255, 255, 0.5);
  font-size: 20rpx;
}

.read-more {
  color: #f7b84b;
  font-weight: 700;
}

.post-stack {
  margin-top: 18rpx;
  overflow: hidden;
  border: 1rpx solid rgba(23, 33, 29, 0.08);
  border-radius: 34rpx;
  background: rgba(255, 253, 248, 0.78);
}

.post-row {
  min-height: 156rpx;
  padding: 20rpx;
  display: flex;
  align-items: center;
  gap: 20rpx;
  border-bottom: 1rpx solid rgba(23, 33, 29, 0.08);
}

.post-row:last-child {
  border-bottom: none;
}

.post-thumbnail {
  width: 118rpx;
  height: 118rpx;
  flex: none;
  border-radius: 24rpx;
  background: #dde6de;
}

.post-placeholder,
.favorite-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #f7b84b;
  background: #163a2b;
  font-family: Georgia, serif;
  font-weight: 700;
}

.post-copy {
  min-width: 0;
  flex: 1;
}

.post-category,
.post-title,
.post-date {
  display: block;
}

.post-category {
  color: #9b611f;
  font-size: 18rpx;
  font-weight: 800;
  letter-spacing: 1rpx;
}

.post-title {
  margin-top: 9rpx;
  overflow: hidden;
  font-family: Georgia, "Songti SC", serif;
  font-size: 28rpx;
  font-weight: 700;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.post-date {
  margin-top: 9rpx;
  color: rgba(23, 33, 29, 0.38);
  font-size: 19rpx;
}

.post-arrow {
  color: rgba(23, 33, 29, 0.26);
  font-size: 40rpx;
}

.favorites-block {
  margin-top: 66rpx;
}

.favorite-scroll {
  width: 100%;
  margin-top: 24rpx;
  white-space: nowrap;
}

.favorite-track {
  display: inline-flex;
  gap: 18rpx;
  padding: 2rpx 4rpx 16rpx;
}

.favorite-card {
  width: 264rpx;
  padding: 16rpx 16rpx 22rpx;
  display: inline-flex;
  flex-direction: column;
  border: 1rpx solid rgba(23, 33, 29, 0.08);
  border-radius: 30rpx;
  background: rgba(255, 253, 248, 0.84);
  white-space: normal;
}

.favorite-image {
  width: 232rpx;
  height: 280rpx;
  border-radius: 22rpx;
  background: #e7efe8;
}

.favorite-badge,
.favorite-title,
.favorite-byline {
  display: block;
}

.favorite-badge {
  margin-top: 18rpx;
  color: #9b611f;
  font-size: 17rpx;
  font-weight: 800;
  letter-spacing: 2rpx;
}

.favorite-title {
  margin-top: 10rpx;
  overflow: hidden;
  font-family: Georgia, "Songti SC", serif;
  font-size: 27rpx;
  font-weight: 700;
  line-height: 37rpx;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.favorite-byline {
  margin-top: 8rpx;
  overflow: hidden;
  color: rgba(23, 33, 29, 0.42);
  font-size: 19rpx;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.garden-note {
  padding: 64rpx 0 30rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  color: rgba(23, 33, 29, 0.34);
  font-size: 20rpx;
}

.garden-note-mark {
  color: #b56b19;
}

.bottom-nav {
  height: 126rpx;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border-top: 1rpx solid rgba(23, 33, 29, 0.09);
  background: rgba(255, 253, 248, 0.97);
  box-shadow: 0 -16rpx 42rpx rgba(23, 33, 29, 0.06);
}

.bottom-nav-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7rpx;
  color: rgba(23, 33, 29, 0.42);
  font-size: 19rpx;
  font-weight: 700;
}

.bottom-nav-item.active {
  color: #163a2b;
}

.bottom-nav-item.active::before {
  content: '';
  position: absolute;
  top: 9rpx;
  width: 44rpx;
  height: 5rpx;
  border-radius: 999rpx;
  background: #f7b84b;
}

.bottom-nav-icon {
  font-size: 32rpx;
  line-height: 34rpx;
}

.safe-bottom {
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
}

.loading-card {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 20rpx;
}

.loading-bar {
  width: 62%;
  height: 22rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.12);
}

.loading-bar-wide {
  width: 88%;
  height: 48rpx;
}

.loading-bar-short {
  width: 40%;
}

.empty-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #ffffff;
}

.empty-title {
  font-family: Georgia, "Songti SC", serif;
  font-size: 34rpx;
  font-weight: 700;
}

.empty-copy {
  margin-top: 14rpx;
  color: rgba(255, 255, 255, 0.55);
  font-size: 22rpx;
}
</style>
