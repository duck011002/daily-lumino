<template>
  <view class="page-shell">
    <view class="status-space" />
    <view class="topbar"><text class="back" @tap="back">‹</text><text class="bar-title">文章详情</text><text class="share" @tap="share">分享</text></view>
    <scroll-view class="page-scroll" scroll-y>
      <view v-if="loading" class="state">正在打开文章…</view>
      <view v-else-if="!post" class="state">文章暂时不可用。</view>
      <view v-else class="article">
        <image v-if="normalizeAssetUrl(post.cover_url)" class="cover" :src="normalizeAssetUrl(post.cover_url)" mode="aspectFill" lazy-load />
        <text class="category">{{ categoryName }}</text><text class="title">{{ post.title }}</text>
        <text v-if="post.excerpt" class="excerpt">{{ post.excerpt }}</text>
        <view class="meta"><text>{{ authorName }}</text><text>{{ formatDate(post.published_at) }}</text><text>{{ post.view_count || 0 }} 阅读</text></view>
        <view v-if="post.tags && post.tags.length" class="tags"><text v-for="tag in post.tags" :key="tag" class="tag"># {{ tag }}</text></view>
        <view class="article-content"><text selectable class="markdown-text">{{ post.content || '作者暂未填写正文。' }}</text></view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import { getBlogPost, normalizeAssetUrl } from '../../services/api'
export default {
  data() { return { slug: '', post: null, loading: true } },
  onLoad(query) { this.slug = query.slug || ''; this.loadPost() },
  computed: { categoryName() { return this.post && this.post.category && this.post.category.name ? this.post.category.name : '技术实践' }, authorName() { return this.post && this.post.author ? (this.post.author.display_name || this.post.author.username || 'Lumino 编辑部') : 'Lumino 编辑部' } },
  methods: {
    normalizeAssetUrl,
    async loadPost() { if (!this.slug) { this.loading = false; return } try { this.post = await getBlogPost(this.slug) } catch (error) { this.post = null } finally { this.loading = false } },
    back() { uni.navigateBack({ delta: 1 }) },
    share() { const title = this.post ? this.post.title : 'Lumino 博客'; uni.setClipboardData({ data: 'https://lovestory1314.fun/blog/' + this.slug, success: () => uni.showToast({ title: '链接已复制', icon: 'success' }), fail: () => uni.showToast({ title: title, icon: 'none' }) }) },
    formatDate(value) { if (!value) return '近期发布'; const date = new Date(value); return date.getFullYear() + '.' + String(date.getMonth() + 1).padStart(2, '0') + '.' + String(date.getDate()).padStart(2, '0') },
  },
}
</script>

<style scoped>
.page-shell { height:100vh;overflow:hidden;background:#f1eee5; }.status-space { height:var(--status-bar-height);background:#f8f6f0; }.topbar { height:100rpx;padding:0 28rpx;display:flex;align-items:center;justify-content:space-between;background:#f8f6f0;border-bottom:1rpx solid rgba(23,33,29,.08); }.back { width:56rpx;color:#163a2b;font-size:58rpx;line-height:54rpx; }.bar-title { color:#17211d;font-family:Georgia,'Songti SC',serif;font-size:27rpx;font-weight:700; }.share { width:56rpx;color:#1d6347;font-size:20rpx;text-align:right; }.page-scroll { height:calc(100vh - var(--status-bar-height) - 100rpx); }.state { padding:160rpx 30rpx;color:rgba(23,33,29,.48);font-size:23rpx;text-align:center; }.article { padding:28rpx 30rpx 80rpx; }.cover { width:100%;height:360rpx;margin-bottom:34rpx;border-radius:32rpx;background:#e4ecdf; }.category { display:block;color:#9b611f;font-size:18rpx;font-weight:800;letter-spacing:4rpx; }.title { display:block;margin-top:14rpx;color:#17211d;font-family:Georgia,'Songti SC',serif;font-size:45rpx;font-weight:700;line-height:62rpx; }.excerpt { display:block;margin-top:22rpx;padding:20rpx;border-radius:20rpx;color:#5e482c;background:#fdf5e7;font-size:22rpx;line-height:35rpx; }.meta { display:flex;flex-wrap:wrap;gap:12rpx 20rpx;margin-top:24rpx;color:rgba(23,33,29,.46);font-size:19rpx; }.tags { display:flex;flex-wrap:wrap;gap:10rpx;margin-top:20rpx; }.tag { padding:8rpx 14rpx;border-radius:999rpx;color:#1d6347;background:#e4ecdf;font-size:18rpx; }.article-content { margin-top:35rpx;padding-top:30rpx;border-top:1rpx solid rgba(23,33,29,.1); }.markdown-text { display:block;color:#28332d;font-size:25rpx;line-height:45rpx;white-space:pre-wrap;word-break:break-word; }
</style>
