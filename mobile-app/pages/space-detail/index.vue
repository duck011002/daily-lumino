<template>
  <view class="page-shell"><view class="status-space" /><view class="topbar"><text class="back" @tap="back">‹</text><text class="bar-title">空间</text><text class="top-symbol">◇</text></view>
    <scroll-view class="page-scroll" scroll-y refresher-enabled :refresher-triggered="refreshing" @refresherrefresh="loadSpace"><view class="content">
      <view v-if="loading" class="state">正在进入空间…</view><view v-else-if="!space" class="state">这个空间暂时不可见，请先登录或确认成员资格。</view>
      <template v-else><view class="hero"><text class="eyebrow">{{ space.type || 'PERSONAL SPACE' }}</text><text class="space-name">{{ space.name }}</text><text class="description">{{ space.description || '在这里保存共同的文字、灵感与重要片段。' }}</text><text class="member-count">{{ members.length }} 位成员</text></view><view class="quick-actions">
  <view class="quick" @tap="openAlbums"><text>▣</text><text>空间相册</text></view>
  <view class="quick" @tap="addAnniversary"><text>❤️</text><text>纪念日</text></view>
  <view class="quick" @tap="createNote"><text>＋</text><text>新建文章</text></view>
</view>
      <view class="heading"><view><text class="kicker">SPACE WRITING</text><text class="heading-title">空间文章</text></view><text class="count">{{ notes.length }}</text></view>
      <view v-if="!notes.length" class="empty">这个空间还没有文章。</view><view v-else class="note-list"><view v-for="note in notes" :key="note.id" class="note-card" @tap="openNote(note)"><image v-if="normalizeAssetUrl(note.cover_url)" class="note-cover" :src="normalizeAssetUrl(note.cover_url)" mode="aspectFill" lazy-load /><view v-else class="note-cover placeholder">文</view><view class="note-copy"><text class="note-title">{{ note.title }}</text><text class="note-excerpt">{{ excerpt(note.content) }}</text><text class="note-meta">{{ authorName(note) }} · {{ formatDate(note.updated_at || note.created_at) }}</text></view><text class="arrow">›</text></view></view></template>
    </view></scroll-view>
  </view>
</template>

<script>
import { getSpace, getSpaceNotes, getSpaceAnniversaries, createSpaceAnniversary, getSpaceActivities, normalizeAssetUrl } from '../../services/api'
export default {
  data() {
    return {
      spaceId: '',
      space: null,
      notes: [],
      anniversaries: [],
      activities: [],
      loading: true,
      refreshing: false
    }
  },
  computed: {
    members() { return this.space && Array.isArray(this.space.members) ? this.space.members : [] }
  },
  onLoad(query) {
    this.spaceId = query.id || '';
    this.loadSpace()
  },
  methods: {
    normalizeAssetUrl,
    async loadSpace() {
      if (!this.spaceId) { this.loading = false; return }
      this.loading = true;
      try {
        const [space, notes, annivs, acts] = await Promise.all([
          getSpace(this.spaceId),
          getSpaceNotes(this.spaceId),
          getSpaceAnniversaries(this.spaceId).catch(() => []),
          getSpaceActivities(this.spaceId).catch(() => [])
        ]);
        this.space = space;
        this.notes = Array.isArray(notes) ? notes : [];
        this.anniversaries = Array.isArray(annivs) ? annivs : [];
        this.activities = Array.isArray(acts) ? acts : [];
      } catch (error) {
        this.space = null;
        this.notes = [];
      } finally {
        this.loading = false;
        this.refreshing = false
      }
    },
    back() { uni.navigateBack({ delta: 1 }) },
    openAlbums() { uni.navigateTo({ url: '/pages/albums/index?spaceId=' + this.spaceId }) },
    createNote() { uni.navigateTo({ url: '/pages/note-editor/index?spaceId=' + this.spaceId }) },
    async addAnniversary() {
      uni.showModal({
        title: '新建纪念日',
        editable: true,
        placeholderText: '请输入纪念日名称（如：相识纪念日）',
        success: async (res) => {
          if (res.confirm && res.content) {
            try {
              await createSpaceAnniversary(this.spaceId, {
                title: res.content.trim(),
                target_date: new Date().toISOString(),
                icon: '❤️'
              })
              uni.showToast({ title: '添加纪念日成功', icon: 'success' })
              this.loadSpace()
            } catch (err) {
              uni.showToast({ title: '添加失败', icon: 'none' })
            }
          }
        }
      })
    },
    openNote(note) { uni.navigateTo({ url: '/pages/note-detail/index?spaceId=' + this.spaceId + '&noteId=' + note.id }) },
    excerpt(value) { const text = String(value || '打开文章，阅读完整内容。').replace(/[#*_>`-]/g, ' ').replace(/\s+/g, ' ').trim(); return text.slice(0, 62) },
    authorName(note) { return note.author ? (note.author.display_name || note.author.username || '空间成员') : '空间成员' },
    formatDate(value) { if (!value) return '刚刚'; const date = new Date(value); return date.getFullYear() + '.' + String(date.getMonth() + 1).padStart(2, '0') + '.' + String(date.getDate()).padStart(2, '0') }
  }
}
</script>

<style scoped>
.page-shell{height:100vh;overflow:hidden;background:#f1eee5}.status-space{height:var(--status-bar-height);background:#f8f6f0}.topbar{height:100rpx;padding:0 28rpx;display:flex;align-items:center;justify-content:space-between;background:#f8f6f0;border-bottom:1rpx solid rgba(23,33,29,.08)}.back{width:56rpx;color:#163a2b;font-size:58rpx;line-height:54rpx}.bar-title{color:#17211d;font-family:Georgia,'Songti SC',serif;font-size:27rpx;font-weight:700}.top-symbol{width:56rpx;color:#9b611f;font-size:29rpx;text-align:right}.page-scroll{height:calc(100vh - var(--status-bar-height) - 100rpx)}.content{padding:28rpx 28rpx 70rpx}.state,.empty{padding:100rpx 20rpx;border-radius:30rpx;color:rgba(23,33,29,.48);background:#fffdf8;font-size:22rpx;text-align:center}.hero{padding:34rpx;border-radius:38rpx;color:#fff;background:#163a2b}.eyebrow,.kicker{display:block;color:#f7b84b;font-size:17rpx;font-weight:800;letter-spacing:4rpx}.space-name{display:block;margin-top:18rpx;font-family:Georgia,'Songti SC',serif;font-size:42rpx;font-weight:700;line-height:56rpx}.description{display:block;margin-top:16rpx;color:rgba(255,255,255,.68);font-size:22rpx;line-height:35rpx}.member-count{display:block;margin-top:22rpx;color:#f7b84b;font-size:19rpx}.quick-actions{display:flex;gap:16rpx;margin-top:18rpx}.quick{flex:1;padding:24rpx;display:flex;align-items:center;gap:13rpx;border-radius:24rpx;color:#163a2b;background:#e4ecdf;font-size:22rpx;font-weight:700}.quick text:first-child{color:#9b611f;font-size:30rpx}.heading{display:flex;align-items:flex-end;justify-content:space-between;margin:48rpx 4rpx 18rpx;padding-bottom:20rpx;border-bottom:1rpx solid rgba(23,33,29,.1)}.kicker{color:#9b611f}.heading-title{display:block;margin-top:9rpx;font-family:Georgia,'Songti SC',serif;font-size:37rpx;font-weight:700}.count{color:rgba(23,33,29,.38);font-size:30rpx}.note-card{min-height:154rpx;padding:18rpx;display:flex;align-items:center;gap:18rpx;border-radius:28rpx;background:#fffdf8}.note-card+.note-card{margin-top:15rpx}.note-cover{width:116rpx;height:116rpx;flex:none;border-radius:19rpx;background:#e4ecdf}.placeholder{display:flex;align-items:center;justify-content:center;color:#f7b84b;background:#163a2b;font-family:Georgia,serif;font-size:36rpx}.note-copy{min-width:0;flex:1}.note-title,.note-excerpt,.note-meta{display:block;overflow:hidden}.note-title{color:#17211d;font-family:Georgia,'Songti SC',serif;font-size:27rpx;font-weight:700;white-space:nowrap;text-overflow:ellipsis}.note-excerpt{margin-top:8rpx;color:rgba(23,33,29,.52);font-size:19rpx;line-height:28rpx;white-space:nowrap;text-overflow:ellipsis}.note-meta{margin-top:10rpx;color:rgba(23,33,29,.38);font-size:17rpx;white-space:nowrap;text-overflow:ellipsis}.arrow{color:rgba(23,33,29,.3);font-size:40rpx}
</style>
