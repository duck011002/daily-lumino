<template>
  <view class="page-shell">
    <view class="status-space" />
    <view class="topbar"><view><text class="kicker">PUBLIC WRITING</text><text class="page-title">博客</text></view><view class="top-mark">文</view></view>
    <scroll-view class="page-scroll" scroll-y refresher-enabled :refresher-triggered="refreshing" @refresherrefresh="refresh" @scrolltolower="loadMore">
      <view class="content">
        <view class="search-row"><input v-model="keyword" class="search-input" confirm-type="search" placeholder="搜索文章标题或摘要" @confirm="search" /><text class="search-action" @tap="search">搜索</text></view>
        <scroll-view class="category-scroll" scroll-x show-scrollbar="false"><view class="category-track"><view v-for="category in categoryOptions" :key="category.slug" class="category-chip" :class="{ active: category.slug === activeCategory }" @tap="chooseCategory(category.slug)">{{ category.name }}</view></view></scroll-view>
        <view class="section-line"><text>{{ activeCategoryName }}</text><text>{{ total }} 篇</text></view>
        <view v-if="loading" class="state-card">正在加载公开文章…</view>
        <view v-else-if="!posts.length" class="state-card">还没有匹配的公开文章。</view>
        <view v-else class="post-list"><view v-for="post in posts" :key="post.id" class="post-card" @tap="openPost(post)"><image v-if="normalizeAssetUrl(post.cover_url)" class="cover" :src="normalizeAssetUrl(post.cover_url)" mode="aspectFill" lazy-load /><view v-else class="cover placeholder">L</view><view class="copy"><text class="category">{{ categoryName(post) }}</text><text class="title">{{ post.title }}</text><text class="excerpt">{{ post.excerpt || '打开文章，阅读完整内容。' }}</text><text class="meta">{{ formatDate(post.published_at) }} · {{ post.view_count || 0 }} 阅读</text></view><text class="arrow">›</text></view></view>
        <view v-if="loadingMore" class="footer-state">正在加载更多…</view><view v-else-if="hasMore && posts.length" class="footer-state" @tap="loadMore">上拉或点按加载更多</view><view v-else-if="posts.length" class="footer-state">已经到底了</view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import { getBlogCategories, getBlogPostsPage, normalizeAssetUrl } from '../../services/api'

export default {
  data() { return { categories: [], activeCategory: '', keyword: '', posts: [], total: 0, page: 1, pages: 1, loading: true, loadingMore: false, refreshing: false } },
  computed: {
    categoryOptions() { return [{ slug: '', name: '全部' }, ...this.categories] },
    activeCategoryName() { const item = this.categoryOptions.find((category) => category.slug === this.activeCategory); return item ? item.name : '全部' },
    hasMore() { return this.page < this.pages },
  },
  onLoad() { this.loadInitial() },
  methods: {
    normalizeAssetUrl,
    async loadInitial() {
      this.loading = true
      try {
        const categories = await getBlogCategories(); this.categories = Array.isArray(categories) ? categories : []
        await this.fetchPage(1, false)
      } catch (error) { this.posts = []; this.total = 0 } finally { this.loading = false; this.refreshing = false }
    },
    async fetchPage(page, append) {
      const data = await getBlogPostsPage({ category: this.activeCategory, q: this.keyword.trim(), page, page_size: 12 })
      const items = Array.isArray(data && data.items) ? data.items : []
      this.posts = append ? [...this.posts, ...items] : items
      this.total = Number(data && data.total) || 0; this.page = Number(data && data.page) || page; this.pages = Number(data && data.pages) || 1
    },
    refresh() { this.refreshing = true; this.loadInitial() },
    async search() { try { await this.loadInitial() } catch (error) {} },
    async chooseCategory(id) { if (id === this.activeCategory) return; this.activeCategory = id; await this.loadInitial() },
    async loadMore() { if (this.loading || this.loadingMore || !this.hasMore) return; this.loadingMore = true; try { await this.fetchPage(this.page + 1, true) } finally { this.loadingMore = false } },
    openPost(post) { if (post.slug) uni.navigateTo({ url: '/pages/blog-detail/index?slug=' + encodeURIComponent(post.slug) }) },
    categoryName(post) { return post.category && post.category.name ? post.category.name : '技术实践' },
    formatDate(value) { if (!value) return '近期发布'; const date = new Date(value); return date.getFullYear() + '.' + String(date.getMonth() + 1).padStart(2, '0') + '.' + String(date.getDate()).padStart(2, '0') },
  },
}
</script>

<style scoped>
.page-shell { height: 100vh; overflow: hidden; background: #f1eee5; }.status-space { height: var(--status-bar-height); background: #f8f6f0; }.topbar { height: 116rpx; padding: 18rpx 32rpx; display: flex; align-items: center; justify-content: space-between; background: #f8f6f0; border-bottom: 1rpx solid rgba(23,33,29,.08); }.kicker,.category { display:block;color:#9b611f;font-size:17rpx;font-weight:800;letter-spacing:4rpx; }.page-title { display:block;margin-top:10rpx;font-family:Georgia,'Songti SC',serif;font-size:42rpx;font-weight:700; }.top-mark { width:68rpx;height:68rpx;display:flex;align-items:center;justify-content:center;border-radius:22rpx;color:#f7b84b;background:#163a2b;font-size:30rpx; }.page-scroll { height:calc(100vh - var(--status-bar-height) - 116rpx); }.content { padding:28rpx 28rpx 54rpx; }.search-row { display:flex;gap:14rpx;align-items:center; }.search-input { height:78rpx;flex:1;padding:0 22rpx;border-radius:20rpx;background:#fffdf8;color:#17211d;font-size:22rpx; }.search-action { padding:17rpx 12rpx;color:#163a2b;font-size:22rpx;font-weight:700; }.category-scroll { margin-top:22rpx;white-space:nowrap; }.category-track { display:flex;gap:12rpx; }.category-chip { padding:14rpx 22rpx;border:1rpx solid rgba(23,33,29,.1);border-radius:999rpx;color:rgba(23,33,29,.55);font-size:21rpx; }.category-chip.active { border-color:#163a2b;color:#fff;background:#163a2b; }.section-line { display:flex;justify-content:space-between;margin:34rpx 4rpx 18rpx;color:rgba(23,33,29,.52);font-size:20rpx; }.state-card { padding:80rpx 24rpx;text-align:center;border-radius:28rpx;color:rgba(23,33,29,.48);background:#fffdf8;font-size:22rpx; }.post-card { position:relative;min-height:180rpx;padding:18rpx;display:flex;gap:18rpx;align-items:center;border-radius:28rpx;background:#fffdf8; }.post-card + .post-card { margin-top:16rpx; }.cover { width:142rpx;height:142rpx;flex:none;border-radius:20rpx;background:#e4ecdf; }.placeholder { display:flex;align-items:center;justify-content:center;color:#f7b84b;background:#163a2b;font-family:Georgia,serif;font-size:40rpx; }.copy { min-width:0;flex:1; }.category { font-size:16rpx;letter-spacing:2rpx; }.title,.excerpt,.meta { display:block;overflow:hidden; }.title { margin-top:9rpx;color:#17211d;font-family:Georgia,'Songti SC',serif;font-size:28rpx;font-weight:700;white-space:nowrap;text-overflow:ellipsis; }.excerpt { margin-top:9rpx;color:rgba(23,33,29,.52);font-size:19rpx;line-height:29rpx;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical; }.meta { margin-top:10rpx;color:rgba(23,33,29,.38);font-size:17rpx;white-space:nowrap;text-overflow:ellipsis; }.arrow { color:rgba(23,33,29,.3);font-size:40rpx; }.footer-state { padding:28rpx 0;color:rgba(23,33,29,.42);font-size:20rpx;text-align:center; }
</style>
