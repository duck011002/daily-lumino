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

    <view class="mode-tabs">
      <view class="mode-tab" :class="{ selected: mode === 'chat' }" @tap="mode = 'chat'">AI 对话</view>
      <view class="mode-tab" :class="{ selected: mode === 'create' }" @tap="mode = 'create'">文章创作</view>
    </view>

    <scroll-view class="page-scroll" scroll-y>
      <view v-if="mode === 'chat'" class="content">
        <view class="chat-intro">
          <text class="welcome-kicker">YOUR CREATIVE COMPANION</text>
          <text class="welcome-title">先聊清楚，再把想法写下来。</text>
          <text class="welcome-copy">AI 对话会保存到你的账号，后续可以继续整理成博客或空间文章。</text>
        </view>

        <view v-if="!isLoggedIn" class="login-card" @tap="goLogin">
          <text class="login-title">登录后开始 AI 对话</text>
          <text class="login-copy">登录态只保存在本机安全存储，不会显示或分享 Token。</text>
          <text class="login-arrow">→</text>
        </view>

          <view v-else class="chat-card">
            <scroll-view class="message-list" scroll-y :scroll-into-view="lastMessageId">
            <view v-if="!messages.length" class="message-empty">你好，我可以帮你梳理文章结构、提炼素材或规划一个空间记录。</view>
            <view v-for="(message, index) in messages" :id="messageId(index)" :key="index" class="message-row" :class="message.role">
              <view class="message-bubble">{{ message.content }}</view>
            </view>
              <view v-if="sending" class="message-row assistant"><view class="message-bubble typing">AI 正在思考…</view></view>
            </scroll-view>
            <ImageUploadGrid v-model="imageItems" />
            <view class="chat-input-row">
              <textarea v-model="chatInput" class="chat-input" auto-height maxlength="4000" placeholder="输入你的想法…" />
            <button class="send-button" :disabled="sending" @tap="sendMessage">发送</button>
          </view>
        </view>
      </view>

      <view v-else class="content">
        <view class="create-intro">
          <text class="welcome-kicker">MULTIMODAL PUBLISHING</text>
          <text class="welcome-title">把素材变成一篇可发布的文章。</text>
          <text class="welcome-copy">支持文字、图片、Markdown、Word 和 PDF。草稿保存到共享后端，Web 端也可以继续编辑。</text>
        </view>

        <view v-if="!isLoggedIn" class="login-card" @tap="goLogin">
          <text class="login-title">登录后开始创作</text>
          <text class="login-copy">不同用户的博客、空间和 MCP 权限由后端控制。</text>
          <text class="login-arrow">→</text>
        </view>

        <view v-else class="composer-card">
          <view class="field-label">发布到</view>
          <view class="target-tabs">
            <view class="target-tab" :class="{ selected: draft.target === 'blog' }" @tap="draft.target = 'blog'">公开博客</view>
            <view class="target-tab" :class="{ selected: draft.target === 'space' }" @tap="draft.target = 'space'">空间文章</view>
          </view>
          <view v-if="draft.target === 'space'" class="field-block">
            <view class="field-label">选择空间</view>
            <picker :range="spaceNames" @change="selectSpace">
              <view class="picker-field">{{ selectedSpaceName }}</view>
            </picker>
          </view>
          <input v-model="draft.title" class="text-field" placeholder="文章标题" placeholder-class="placeholder" />
          <textarea v-model="draft.content" class="content-field" auto-height maxlength="20000" placeholder="输入正文，或先上传文件解析…" placeholder-class="placeholder" />
          <view class="attachment-row">
            <button class="attachment-button" @tap="chooseAttachment">＋ 文档</button>
            <text class="attachment-hint">图片 / TXT / MD / DOCX / PDF</text>
          </view>
          <ImageUploadGrid v-model="imageItems" @change="syncImages" />
          <view v-if="ingestMessage" class="ingest-message">{{ ingestMessage }}</view>
          <view class="publish-row">
            <button class="draft-button" :disabled="publishing" @tap="saveDraft">保存草稿</button>
            <button class="publish-button" :disabled="publishing" @tap="publishDraft">{{ publishLabel }}</button>
          </view>
          <text class="permission-note">{{ permissionNote }}</text>
        </view>
      </view>
    </scroll-view>

    <view class="bottom-nav safe-bottom">
      <view class="bottom-nav-item" @tap="go('/pages/index/index')">
        <image class="nav-icon-img" :src="getNavIcon('front', false)" mode="aspectFit" />
        <text>前厅</text>
      </view>
      <view class="bottom-nav-item active">
        <image class="nav-icon-img" :src="getNavIcon('ai', true)" mode="aspectFit" />
        <text>AI</text>
      </view>
      <view class="bottom-nav-item" @tap="go('/pages/spaces/index')">
        <image class="nav-icon-img" :src="getNavIcon('courtyard', false)" mode="aspectFit" />
        <text>内院</text>
      </view>
      <view class="bottom-nav-item" @tap="go('/pages/account/index')">
        <image class="nav-icon-img" :src="getNavIcon('account', false)" mode="aspectFit" />
        <text>我的</text>
      </view>
    </view>
  </view>
</template>

<script>
import {
  createAIDraft,
  createChatSession,
  getCapabilities,
  getChatSession,
  getCurrentUser,
  getSpaces,
  ingestAttachment,
  sendChatMessage,
} from '../../services/api'
import ImageUploadGrid from '../../components/ImageUploadGrid.vue'

export default {
  components: { ImageUploadGrid },
  data() {
    return {
      mode: 'chat',
      user: null,
      capabilities: {},
      spaces: [],
      chatSession: null,
      messages: [],
      chatInput: '',
      sending: false,
      draft: { target: 'blog', title: '', content: '', space_id: null, cover_url: '' },
      imageItems: [],
      publishing: false,
      ingestMessage: '',
    }
  },
  computed: {
    isLoggedIn() {
      return Boolean(uni.getStorageSync('lumino_access_token')) && Boolean(this.user)
    },
    spaceNames() {
      return this.spaces.map((space) => space.name)
    },
    selectedSpaceName() {
      const space = this.spaces.find((item) => item.id === this.draft.space_id)
      if (space) return space.name
      return this.spaceNames[0] || '请先创建或加入空间'
    },
    publishLabel() {
      if (this.draft.target === 'blog') return '发布博客'
      return '发布到空间'
    },
    permissionNote() {
      if (this.draft.target === 'blog' && !this.capabilities.can_publish_blog) return '当前账号没有博客发布权限，可先保存草稿。'
      if (this.capabilities.can_mcp_publish) return 'MCP 发布已由后端授权，发布前仍会保留草稿记录。'
      return '发布权限由后端统一控制，文章会与 Web 共用。'
    },
    lastMessageId() {
      if (!this.messages.length) return ''
      return this.messageId(this.messages.length - 1)
    },
    uploadedImageUrls() {
      return this.imageItems.filter((item) => item.status === 'success' && item.url).map((item) => item.url)
    },
  },
  onShow() {
    this.loadUser()
  },
  methods: {
    async loadUser() {
      if (!uni.getStorageSync('lumino_access_token')) {
        this.user = null
        return
      }
      try {
        this.user = await getCurrentUser()
        this.capabilities = await getCapabilities()
        const data = await getSpaces()
        if (Array.isArray(data)) this.spaces = data
      } catch (error) {
        this.user = null
      }
    },
    async ensureChatSession() {
      if (this.chatSession) return this.chatSession
      const session = await createChatSession('Lumino 移动端对话', 'qwen')
      this.chatSession = session
      return session
    },
    async sendMessage() {
      if (!this.chatInput.trim() || this.sending) return
      this.sending = true
      const content = this.chatInput.trim()
      this.chatInput = ''
      this.messages.push({ role: 'user', content })
      try {
        const session = await this.ensureChatSession()
        const raw = await sendChatMessage(session.id, content, this.uploadedImageUrls)
        const parsed = this.parseSSE(raw)
        const answer = parsed || 'AI 暂时没有返回内容，请稍后重试。'
        this.messages.push({ role: 'assistant', content: answer })
        this.imageItems = []
      } catch (error) {
        this.messages.push({ role: 'assistant', content: '连接 AI 失败，请检查登录状态或稍后重试。' })
      } finally {
        this.sending = false
      }
    },
    parseSSE(raw) {
      if (typeof raw !== 'string') return ''
      const chunks = []
      const matches = raw.matchAll(/data: (.+)\n/g)
      for (const match of matches) {
        try {
          const item = JSON.parse(match[1])
          if (item.type === 'chunk') chunks.push(item.content || '')
        } catch (error) {
          continue
        }
      }
      return chunks.join('')
    },
    async chooseAttachment() {
      try {
        const result = await new Promise((resolve, reject) => {
          uni.chooseFile({ count: 1, success: resolve, fail: reject })
        })
        const file = result.tempFiles[0]
        this.ingestMessage = '正在解析 ' + file.name + '…'
        const parsed = await ingestAttachment(file.path, file.name, file.type || '')
        if (parsed.extracted_text) {
          if (this.draft.content) this.draft.content += '\n\n' + parsed.extracted_text
          else this.draft.content = parsed.extracted_text
        }
        if (parsed.status === 'failed') this.ingestMessage = parsed.error_message || '文件解析失败。'
        else this.ingestMessage = '解析完成，已将内容加入正文。'
      } catch (error) {
        this.ingestMessage = '没有选择文件，或当前平台不支持文件选择。'
      }
    },
    syncImages(items) {
      const successful = items.filter((item) => item.status === 'success' && item.url)
      const urls = successful.map((item) => item.url)
      if (!urls.length) {
        this.draft.cover_url = ''
        return
      }
      if (!urls.includes(this.draft.cover_url)) this.draft.cover_url = urls[0]
      this.ingestMessage = successful.length ? '图片已上传，可用于 AI 对话或作为文章封面。' : '正在准备图片…'
    },
    selectSpace(event) {
      const index = Number(event.detail.value)
      const space = this.spaces[index]
      if (space) this.draft.space_id = space.id
    },
    async saveDraft() {
      await this.submitDraft(false)
    },
    async publishDraft() {
      await this.submitDraft(true)
    },
    async submitDraft(publish) {
      if (!this.draft.title.trim() || !this.draft.content.trim()) {
        uni.showToast({ title: '请填写标题和正文', icon: 'none' })
        return
      }
      if (this.draft.target === 'space' && !this.draft.space_id && this.spaces.length) {
        this.draft.space_id = this.spaces[0].id
      }
      if (this.draft.target === 'space' && !this.draft.space_id) {
        uni.showToast({ title: '请先选择空间', icon: 'none' })
        return
      }
      if (publish && this.draft.target === 'blog' && !this.capabilities.can_publish_blog) {
        uni.showToast({ title: '当前没有博客发布权限', icon: 'none' })
        return
      }
      this.publishing = true
      try {
        const result = await createAIDraft({ ...this.draft, publish })
        let message = '草稿已保存'
        if (result.status === 'published') message = '发布成功'
        uni.showToast({ title: message, icon: 'success' })
        this.draft.title = ''
        this.draft.content = ''
        this.draft.cover_url = ''
        this.imageItems = []
        this.ingestMessage = ''
      } catch (error) {
        uni.showToast({ title: '提交失败，请检查权限', icon: 'none' })
      } finally {
        this.publishing = false
      }
    },
    messageId(index) {
      return 'message-' + index
    },
    goLogin() {
      uni.navigateTo({ url: '/pages/login/index' })
    },
    go(url) {
      uni.navigateTo({ url })
    },
    getNavIcon(key, isActive) {
      const activeIcons = {
        front: 'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMxNjNhMmIiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJtMyA5IDktNyA5IDd2MTFhMiAyIDAgMCAxLTIgMkg1YTIgMiAwIDAgMS0yLTJ6Ii8+PHBvbHlsaW5lIHBvaW50cz0iOSAyMiA5IDEyIDE1IDEyIDE1IDIyIi8+PC9zdmc+',
        ai: 'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMxNjNhMmIiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJtMTIgMy0xLjkgNS44YTIgMiAwIDAgMS0xLjMgMS4zTDMgMTJsNS44IDEuOWEyIDIgMCAwIDEgMS4zIDEuM0wxMiAyMWwxLjktNS44YTIgMiAwIDAgMSAxLjMtMS4zTDIxIDEybC01LjgtMS45YTIgMiAwIDAgMS0xLjMtMS4zeiIvPjwvc3ZnPg==',
        courtyard: 'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMxNjNhMmIiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHg9IjMiIHk9IjMiIHJ4PSIyIi8+PHBhdGggZD0iTTcgMTB2NCIvPjxwYXRoIGQ9Ik0xNyAxMHY0Ii8+PHBhdGggZD0iTTEyIDd2MTAiLz48L3N2Zz4=',
        account: 'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMxNjNhMmIiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTkgMjF2LTJhNCA0IDAgMCAwLTQtNEg5YTQgNCAwIDAgMC04IDR2MiIvPjxjaXJjbGUgY3g9IjEyIiBjeT0iNyIgcj0iNCIvPjwvc3ZnPg=='
      }
      const inactiveIcons = {
        front: 'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM4ZTk1OTIiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJtMyA5IDktNyA5IDd2MTFhMiAyIDAgMCAxLTIgMkg1YTIgMiAwIDAgMS0yLTJ6Ii8+PHBvbHlsaW5lIHBvaW50cz0iOSAyMiA5IDEyIDE1IDEyIDE1IDIyIi8+PC9zdmc+',
        ai: 'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM4ZTk1OTIiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJtMTIgMy0xLjkgNS44YTIgMiAwIDAgMS0xLjMgMS4zTDMgMTJsNS44IDEuOWEyIDIgMCAwIDEgMS4zIDEuM0wxMiAyMWwxLjktNS44YTIgMiAwIDAgMSAxLjMtMS4zTDIxIDEybC01LjgtMS45YTIgMiAwIDAgMS0xLjMtMS4zeiIvPjwvc3ZnPg==',
        courtyard: 'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM4ZTk1OTIiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHg9IjMiIHk9IjMiIHJ4PSIyIi8+PHBhdGggZD0iTTcgMTB2NCIvPjxwYXRoIGQ9Ik0xNyAxMHY0Ii8+PHBhdGggZD0iTTEyIDd2MTAiLz48L3N2Zz4=',
        account: 'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM4ZTk1OTIiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTkgMjF2LTJhNCA0IDAgMCAwLTQtNEg5YTQgNCAwIDAgMC04IDR2MiIvPjxjaXJjbGUgY3g9IjEyIiBjeT0iNyIgcj0iNCIvPjwvc3ZnPg=='
      }
      const b64 = isActive ? activeIcons[key] : inactiveIcons[key]
      return 'data:image/svg+xml;base64,' + b64
    },
  },
}
</script>

<style scoped>
.page-shell { height: 100vh; overflow: hidden; background: #f1eee5; }
.status-space { height: var(--status-bar-height); background: rgba(248, 246, 240, 0.95); }
.topbar { height: 116rpx; padding: 18rpx 32rpx; display: flex; align-items: center; justify-content: space-between; background: rgba(248, 246, 240, 0.95); border-bottom: 1rpx solid rgba(23, 33, 29, 0.08); }
.kicker, .welcome-kicker, .field-label { display: block; color: #9b611f; font-size: 17rpx; font-weight: 800; letter-spacing: 4rpx; }
.page-title { display: block; margin-top: 10rpx; font-family: Georgia, 'Songti SC', serif; font-size: 42rpx; font-weight: 700; }
.top-mark { width: 68rpx; height: 68rpx; display: flex; align-items: center; justify-content: center; border-radius: 22rpx; color: #f7b84b; background: #163a2b; font-size: 34rpx; }
.mode-tabs { height: 82rpx; padding: 12rpx 28rpx; display: flex; gap: 10rpx; background: #f8f6f0; }
.mode-tab { flex: 1; display: flex; align-items: center; justify-content: center; border-radius: 20rpx; color: rgba(23, 33, 29, 0.45); font-size: 23rpx; font-weight: 700; }
.mode-tab.selected { color: #fff; background: #163a2b; }
.page-scroll { height: calc(100vh - var(--status-bar-height) - 116rpx - 82rpx - 126rpx); }
.content { padding: 24rpx 28rpx 56rpx; }
.chat-intro, .create-intro { padding: 30rpx; border-radius: 38rpx; color: #fff; background: #163a2b; box-shadow: 0 25rpx 50rpx rgba(22, 58, 43, 0.16); }
.create-intro { background: #25543f; }
.welcome-kicker { color: #f7b84b; }
.welcome-title { display: block; margin-top: 22rpx; font-family: Georgia, 'Songti SC', serif; font-size: 38rpx; font-weight: 700; line-height: 54rpx; }
.welcome-copy { display: block; margin-top: 16rpx; color: rgba(255, 255, 255, 0.64); font-size: 23rpx; line-height: 37rpx; }
.login-card { position: relative; margin-top: 18rpx; padding: 28rpx; border-radius: 30rpx; background: #f4d8a4; }
.login-title { display: block; font-family: Georgia, 'Songti SC', serif; font-size: 29rpx; font-weight: 700; }
.login-copy { display: block; margin-top: 10rpx; max-width: 540rpx; color: rgba(23, 33, 29, 0.55); font-size: 20rpx; line-height: 31rpx; }
.login-arrow { position: absolute; right: 26rpx; top: 42rpx; color: #9b611f; font-size: 32rpx; }
.chat-card, .composer-card { margin-top: 18rpx; padding: 18rpx; border: 1rpx solid rgba(23, 33, 29, 0.08); border-radius: 30rpx; background: rgba(255, 253, 248, 0.88); }
.message-list { height: 610rpx; padding: 8rpx; }
.message-empty { padding: 45rpx 28rpx; color: rgba(23, 33, 29, 0.42); font-size: 22rpx; line-height: 37rpx; text-align: center; }
.message-row { display: flex; margin: 16rpx 0; }
.message-row.user { justify-content: flex-end; }
.message-bubble { max-width: 82%; padding: 18rpx 22rpx; border-radius: 24rpx; color: #17211d; background: #e4ecdf; font-size: 23rpx; line-height: 36rpx; white-space: pre-wrap; }
.message-row.user .message-bubble { color: #fff; background: #1d6347; }
.typing { color: rgba(23, 33, 29, 0.48); }
.chat-input-row { display: flex; align-items: flex-end; gap: 12rpx; padding-top: 14rpx; border-top: 1rpx solid rgba(23, 33, 29, 0.08); }
.chat-input { min-height: 72rpx; max-height: 210rpx; flex: 1; padding: 16rpx; border-radius: 20rpx; background: #f1eee5; font-size: 23rpx; }
.image-button { width: 68rpx; height: 72rpx; margin: 0; padding: 0; border-radius: 20rpx; color: #163a2b; background: #f4d8a4; font-size: 20rpx; }
.send-button { width: 112rpx; height: 72rpx; margin: 0; padding: 0; border-radius: 20rpx; color: #fff; background: #163a2b; font-size: 22rpx; }
.send-button::after, .image-button::after, .draft-button::after, .publish-button::after, .attachment-button::after { border: none; }
.field-label { margin: 8rpx 0 14rpx; letter-spacing: 2rpx; }
.target-tabs { display: flex; gap: 12rpx; }
.target-tab { flex: 1; padding: 19rpx 0; border: 1rpx solid rgba(23, 33, 29, 0.1); border-radius: 18rpx; color: rgba(23, 33, 29, 0.48); font-size: 22rpx; text-align: center; }
.target-tab.selected { border-color: #163a2b; color: #fff; background: #163a2b; }
.field-block { margin-top: 22rpx; }
.picker-field, .text-field, .content-field { width: 100%; padding: 20rpx; border: 1rpx solid rgba(23, 33, 29, 0.1); border-radius: 18rpx; background: #f1eee5; color: #17211d; font-size: 23rpx; }
.text-field { height: 82rpx; margin-top: 22rpx; }
.content-field { min-height: 320rpx; margin-top: 14rpx; line-height: 35rpx; }
.placeholder { color: rgba(23, 33, 29, 0.36); }
.attachment-row { display: flex; align-items: center; gap: 14rpx; margin-top: 16rpx; }
.attachment-button { height: 70rpx; margin: 0; padding: 0 22rpx; border-radius: 18rpx; color: #17211d; background: #f4d8a4; font-size: 21rpx; }
.image-attachment { background: #e4ecdf; }
.attachment-hint { color: rgba(23, 33, 29, 0.4); font-size: 18rpx; }
.ingest-message, .permission-note { display: block; margin-top: 14rpx; color: rgba(23, 33, 29, 0.48); font-size: 19rpx; line-height: 30rpx; }
.publish-row { display: flex; gap: 12rpx; margin-top: 22rpx; }
.draft-button, .publish-button { flex: 1; height: 78rpx; margin: 0; border-radius: 20rpx; font-size: 22rpx; font-weight: 700; }
.draft-button { color: #163a2b; background: #e4ecdf; }
.publish-button { color: #fff; background: #163a2b; }
.bottom-nav { height: 126rpx; display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1rpx solid rgba(23, 33, 29, 0.09); background: rgba(255, 253, 248, 0.97); box-shadow: 0 -16rpx 42rpx rgba(23, 33, 29, 0.06); }
.bottom-nav-item { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7rpx; color: rgba(23, 33, 29, 0.42); font-size: 19rpx; font-weight: 700; }
.bottom-nav-item.active { color: #163a2b; }
.bottom-nav-item.active::before { content: ''; position: absolute; top: 8rpx; width: 44rpx; height: 5rpx; border-radius: 999rpx; background: #f7b84b; }
.svg-icon, .nav-icon-img {
  width: 42rpx !important;
  height: 42rpx !important;
  display: block !important;
}
.bottom-nav-item.active .svg-icon { stroke: #163a2b; }
.safe-bottom { padding-bottom: constant(safe-area-inset-bottom); padding-bottom: env(safe-area-inset-bottom); }
</style>
