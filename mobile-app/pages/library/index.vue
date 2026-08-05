<template>
  <view class="page-shell">
    <view class="status-space" />
    <view class="topbar"><view><text class="kicker">PUBLIC SHELVES</text><text class="page-title">书房</text></view><view class="top-mark">书</view></view>
    <scroll-view class="page-scroll" scroll-y refresher-enabled :refresher-triggered="refreshing" @refresherrefresh="loadCards">
      <view class="content">
        <view class="intro"><text class="intro-title">公开收藏，与每一次被认真记住的相遇。</text><text class="intro-copy">书籍、影像、音乐和生活片段，与 Web 端共用同一份公开书房。</text></view>
        <view class="filter-row"><view v-for="filter in filters" :key="filter.key" class="filter" :class="{ active: activeFilter === filter.key }" @tap="activeFilter = filter.key">{{ filter.label }}</view></view>
        <view v-if="loading" class="state-card">正在整理书房…</view><view v-else-if="!visibleCards.length" class="state-card">这个分类暂时没有公开收藏。</view>
        <view v-else class="card-grid"><view v-for="card in visibleCards" :key="card.id" class="media-card" @tap="openCard(card)"><image v-if="normalizeAssetUrl(card.image_url)" class="media-image" :src="normalizeAssetUrl(card.image_url)" mode="aspectFill" lazy-load /><view v-else class="media-image placeholder">{{ glyph(card.category) }}</view><text class="badge">{{ label(card.category) }}</text><text class="media-title">{{ card.title }}</text><text v-if="byline(card)" class="media-subtitle">{{ byline(card) }}</text></view></view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import { getPublicLibrary, normalizeAssetUrl } from '../../services/api'
export default {
  data() { return { cards: [], loading: true, refreshing: false, activeFilter: 'all', filters: [{ key: 'all', label: '全部' }, { key: 'book', label: '书籍' }, { key: 'movie', label: '影像' }, { key: 'music', label: '音乐' }, { key: 'status', label: '日常' }] } },
  computed: { visibleCards() { return this.activeFilter === 'all' ? this.cards : this.cards.filter((card) => card.category === this.activeFilter) } },
  onLoad() { this.loadCards() },
  methods: {
    normalizeAssetUrl,
    async loadCards() { this.loading = true; try { this.cards = await getPublicLibrary() } catch (error) { this.cards = [] } finally { this.loading = false; this.refreshing = false } },
    glyph(category) { return { book: '书', movie: '影', music: '乐', status: '✦' }[category] || 'L' },
    label(category) { return { book: '书籍', movie: '影视', music: '音乐', status: '生活收藏' }[category] || '收藏' },
    byline(card) { return [card.creator || card.subtitle, card.year].filter(Boolean).join(' · ') },
    openCard(card) { const detail = [card.creator || card.subtitle, card.year, card.note].filter(Boolean).join('\n\n'); if (card.url) { uni.showModal({ title: card.title, content: detail || '复制相关链接后可在浏览器打开。', confirmText: '复制链接', success: (result) => { if (result.confirm) uni.setClipboardData({ data: card.url }) } }) } else uni.showModal({ title: card.title, content: detail || '这是一项公开收藏。', showCancel: false }) },
  },
}
</script>

<style scoped>
.page-shell{height:100vh;overflow:hidden;background:#f1eee5}.status-space{height:var(--status-bar-height);background:#f8f6f0}.topbar{height:116rpx;padding:18rpx 32rpx;display:flex;align-items:center;justify-content:space-between;background:#f8f6f0;border-bottom:1rpx solid rgba(23,33,29,.08)}.kicker{display:block;color:#9b611f;font-size:17rpx;font-weight:800;letter-spacing:4rpx}.page-title{display:block;margin-top:10rpx;font-family:Georgia,'Songti SC',serif;font-size:42rpx;font-weight:700}.top-mark{width:68rpx;height:68rpx;display:flex;align-items:center;justify-content:center;border-radius:22rpx;color:#f7b84b;background:#163a2b;font-size:30rpx}.page-scroll{height:calc(100vh - var(--status-bar-height) - 116rpx)}.content{padding:28rpx 28rpx 66rpx}.intro{padding:32rpx;border-radius:38rpx;background:#e4ecdf}.intro-title{display:block;color:#163a2b;font-family:Georgia,'Songti SC',serif;font-size:36rpx;font-weight:700;line-height:52rpx}.intro-copy{display:block;margin-top:16rpx;color:rgba(23,33,29,.56);font-size:22rpx;line-height:34rpx}.filter-row{display:flex;gap:12rpx;margin:26rpx 0;overflow-x:auto;white-space:nowrap}.filter{padding:13rpx 21rpx;border:1rpx solid rgba(23,33,29,.1);border-radius:999rpx;color:rgba(23,33,29,.54);font-size:20rpx}.filter.active{border-color:#163a2b;color:#fff;background:#163a2b}.state-card{padding:92rpx 22rpx;border-radius:28rpx;color:rgba(23,33,29,.48);background:#fffdf8;font-size:22rpx;text-align:center}.card-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18rpx}.media-card{min-width:0;padding:13rpx 13rpx 20rpx;border-radius:26rpx;background:#fffdf8}.media-image{width:100%;height:242rpx;border-radius:18rpx;background:#e4ecdf}.placeholder{display:flex;align-items:center;justify-content:center;color:#f7b84b;background:#163a2b;font-family:Georgia,serif;font-size:46rpx}.badge{display:block;margin-top:14rpx;color:#9b611f;font-size:16rpx;font-weight:800;letter-spacing:2rpx}.media-title,.media-subtitle{display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.media-title{margin-top:7rpx;color:#17211d;font-family:Georgia,'Songti SC',serif;font-size:25rpx;font-weight:700}.media-subtitle{margin-top:7rpx;color:rgba(23,33,29,.46);font-size:18rpx}
</style>
