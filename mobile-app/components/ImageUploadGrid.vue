<template>
  <view class="uploader">
    <view class="uploader-head">
      <view>
        <text class="title">图片素材</text>
        <text class="hint">单张不超过 {{ maxSizeMB }}MB，同时上传 2 张</text>
      </view>
      <text class="count">{{ successfulCount }}/{{ maxCount }}</text>
    </view>
    <view class="grid">
      <view v-for="item in items" :key="item.id" class="image-card" @tap="openItem(item)">
        <image class="thumb" :src="item.localPath || item.url" mode="aspectFill" lazy-load />
        <view v-if="item.status === 'uploading'" class="state-mask">
          <text>{{ item.progress }}%</text>
        </view>
        <view v-else-if="item.status === 'failed'" class="state-mask error-mask">
          <text>上传失败</text>
          <text class="retry">点按重试</text>
        </view>
        <view v-else-if="item.status === 'compressing'" class="state-mask"><text>准备中</text></view>
        <view v-else class="ready-mark">✓</view>
        <view class="remove" @tap.stop="removeItem(item)">×</view>
      </view>
      <view v-if="items.length < maxCount" class="add-card" @tap="chooseImages">
        <text class="add-icon">＋</text>
        <text>添加图片</text>
      </view>
    </view>
    <text v-if="notice" class="notice">{{ notice }}</text>
  </view>
</template>

<script>
import { createImageUploadTask } from '../services/api'

const MAX_BYTES_PER_IMAGE = 10 * 1024 * 1024

function extensionOf(path) {
  const match = String(path || '').match(/\.([a-zA-Z0-9]+)(?:$|[?#])/)
  return match ? match[1].toLowerCase() : 'jpg'
}

function mimeOf(path) {
  const extension = extensionOf(path)
  const types = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', heic: 'image/heic' }
  return types[extension] || 'image/jpeg'
}

export default {
  props: {
    modelValue: { type: Array, default: () => [] },
    maxCount: { type: Number, default: 6 },
    uploadTaskFactory: { type: Function, default: null },
  },
  emits: ['update:modelValue', 'change', 'remove'],
  data() {
    return { items: [], notice: '', tasks: {} }
  },
  computed: {
    successfulCount() {
      return this.items.filter((item) => item.status === 'success').length
    },
    maxSizeMB() {
      return Math.round(MAX_BYTES_PER_IMAGE / 1024 / 1024)
    },
  },
  watch: {
    modelValue: {
      immediate: true,
      handler(value) {
        const incoming = Array.isArray(value) ? value : []
        const currentIds = this.items.map((item) => item.id).join('|')
        const incomingIds = incoming.map((item) => item.id).join('|')
        if (currentIds !== incomingIds) this.items = incoming.map((item) => ({ ...item }))
      },
    },
  },
  beforeUnmount() {
    Object.values(this.tasks).forEach((task) => task.abort && task.abort())
  },
  methods: {
    emitChange() {
      const snapshot = this.items.map((item) => ({ ...item }))
      this.$emit('update:modelValue', snapshot)
      this.$emit('change', snapshot)
    },
    async chooseImages() {
      const remaining = this.maxCount - this.items.length
      if (remaining <= 0) return
      try {
        const result = await new Promise((resolve, reject) => {
          uni.chooseImage({ count: remaining, sizeType: ['compressed'], sourceType: ['album', 'camera'], success: resolve, fail: reject })
        })
        const paths = (result.tempFilePaths || []).slice(0, remaining)
        const accepted = []
        for (const path of paths) {
          const size = await this.getFileSize(path)
          if (size > MAX_BYTES_PER_IMAGE) {
            this.notice = '已跳过超过 ' + this.maxSizeMB + 'MB 的图片。'
            continue
          }
          accepted.push({ id: Date.now() + '-' + Math.random().toString(36).slice(2), localPath: path, url: '', status: 'compressing', progress: 0, error: '' })
        }
        if (!accepted.length) return
        this.items.push(...accepted)
        this.emitChange()
        await this.runUploadQueue(accepted)
      } catch (error) {
        if (error && error.errMsg && error.errMsg.includes('cancel')) return
        this.notice = '无法读取图片，请检查相册或相机权限。'
      }
    },
    getFileSize(path) {
      return new Promise((resolve) => {
        if (typeof uni.getFileInfo !== 'function') return resolve(0)
        uni.getFileInfo({ filePath: path, success: (info) => resolve(Number(info.size) || 0), fail: () => resolve(0) })
      })
    },
    async runUploadQueue(items) {
      const pending = [...items]
      const worker = async () => {
        while (pending.length) {
          const item = pending.shift()
          if (item) await this.prepareAndUpload(item)
        }
      }
      await Promise.all([worker(), worker()])
    },
    async prepareAndUpload(item) {
      try {
        const preparedPath = await this.compressIfNeeded(item.localPath)
        if (!this.items.some((current) => current.id === item.id)) return
        item.localPath = preparedPath
        item.status = 'uploading'
        item.progress = 0
        this.emitChange()
        const createTask = this.uploadTaskFactory || createImageUploadTask
        const task = createTask(preparedPath, 'lumino-' + item.id + '.' + extensionOf(preparedPath), mimeOf(preparedPath), (progress) => {
          item.progress = progress
          this.emitChange()
        })
        this.tasks[item.id] = task
        const result = await task.promise
        if (!this.items.some((current) => current.id === item.id)) return
        item.url = result && result.url ? result.url : ''
        item.remote = result || null
        item.progress = 100
        item.status = item.url ? 'success' : 'failed'
        item.error = item.url ? '' : '服务未返回图片地址'
      } catch (error) {
        if (!this.items.some((current) => current.id === item.id)) return
        item.status = 'failed'
        item.error = '上传失败，请重试'
      } finally {
        delete this.tasks[item.id]
        this.emitChange()
      }
    },
    compressIfNeeded(path) {
      const extension = extensionOf(path)
      if (!['jpg', 'jpeg', 'png', 'webp'].includes(extension) || typeof uni.compressImage !== 'function') return Promise.resolve(path)
      return new Promise((resolve) => {
        uni.compressImage({ src: path, quality: 78, success: (result) => resolve(result.tempFilePath || path), fail: () => resolve(path) })
      })
    },
    openItem(item) {
      if (item.status === 'failed') {
        item.status = 'compressing'
        item.progress = 0
        item.error = ''
        this.emitChange()
        this.runUploadQueue([item])
        return
      }
      if (item.status !== 'success') return
      const urls = this.items.filter((current) => current.status === 'success').map((current) => current.url)
      uni.previewImage({ current: item.url, urls })
    },
    removeItem(item) {
      const task = this.tasks[item.id]
      if (task && task.abort) task.abort()
      delete this.tasks[item.id]
      this.items = this.items.filter((current) => current.id !== item.id)
      this.$emit('remove', { ...item })
      this.emitChange()
    },
  },
}
</script>

<style scoped>
.uploader { margin-top: 20rpx; padding: 22rpx; border: 1rpx solid rgba(23, 33, 29, 0.09); border-radius: 24rpx; background: #f8f6f0; }
.uploader-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20rpx; }
.title, .hint, .notice { display: block; }
.title { color: #17211d; font-size: 23rpx; font-weight: 700; }
.hint, .notice { margin-top: 6rpx; color: rgba(23, 33, 29, 0.48); font-size: 18rpx; }
.count { color: #9b611f; font-size: 20rpx; font-weight: 700; }
.grid { display: flex; flex-wrap: wrap; gap: 14rpx; margin-top: 18rpx; }
.image-card, .add-card { position: relative; width: 140rpx; height: 140rpx; overflow: hidden; border-radius: 18rpx; background: #e4ecdf; }
.thumb { width: 100%; height: 100%; }
.add-card { display: flex; flex-direction: column; align-items: center; justify-content: center; border: 1rpx dashed rgba(22, 58, 43, 0.38); color: #163a2b; font-size: 19rpx; }
.add-icon { margin-bottom: 5rpx; font-size: 38rpx; line-height: 40rpx; }
.state-mask { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #fff; background: rgba(22, 58, 43, 0.66); font-size: 21rpx; }
.error-mask { background: rgba(128, 62, 36, 0.78); }
.retry { margin-top: 5rpx; font-size: 17rpx; }
.ready-mark, .remove { position: absolute; display: flex; align-items: center; justify-content: center; border-radius: 999rpx; }
.ready-mark { left: 9rpx; bottom: 9rpx; width: 30rpx; height: 30rpx; color: #fff; background: #1d6347; font-size: 18rpx; }
.remove { top: 7rpx; right: 7rpx; width: 34rpx; height: 34rpx; color: #fff; background: rgba(23, 33, 29, 0.65); font-size: 27rpx; line-height: 30rpx; }
</style>
