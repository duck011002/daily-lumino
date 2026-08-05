<template>
  <view class="login-shell">
    <view class="status-space" />
    <view class="login-content">
      <view class="brand-mark">L</view>
      <text class="kicker">WELCOME BACK</text>
      <text class="title">回到你的数字庭院</text>
      <text class="copy">登录后继续使用 AI 对话、文件解析、空间文章和同步草稿。</text>

      <view class="form-card">
        <input v-model="username" class="field" placeholder="用户名或邮箱" placeholder-class="placeholder" />
        <input v-model="password" class="field" password placeholder="密码" placeholder-class="placeholder" @confirm="submit" />
        <button class="submit-button" :loading="loading" @tap="submit">登录 Lumino</button>
        <text v-if="errorMessage" class="error-message">{{ errorMessage }}</text>
      </view>

      <text class="hint">账号注册和邀请码申请请先使用 Web 端完成。</text>
    </view>
  </view>
</template>

<script>
import { login } from '../../services/api'

export default {
  data() {
    return { username: '', password: '', loading: false, errorMessage: '' }
  },
  methods: {
    async submit() {
      if (!this.username || !this.password) {
        this.errorMessage = '请输入用户名和密码。'
        return
      }
      this.loading = true
      this.errorMessage = ''
      try {
        await login(this.username, this.password)
        uni.showToast({ title: '登录成功', icon: 'success' })
        setTimeout(() => uni.navigateBack(), 500)
      } catch (error) {
        this.errorMessage = '登录失败，请检查账号或密码。'
      } finally {
        this.loading = false
      }
    },
  },
}
</script>

<style scoped>
.login-shell { min-height: 100vh; background: radial-gradient(circle at 90% 0%, #f4d8a4, transparent 480rpx), #f1eee5; }
.status-space { height: var(--status-bar-height); }
.login-content { padding: 100rpx 42rpx 80rpx; }
.brand-mark { width: 86rpx; height: 86rpx; display: flex; align-items: center; justify-content: center; border-radius: 28rpx; color: #f7b84b; background: #163a2b; font-family: Georgia, serif; font-size: 48rpx; font-weight: 700; box-shadow: 0 20rpx 44rpx rgba(22, 58, 43, 0.2); }
.kicker { display: block; margin-top: 58rpx; color: #9b611f; font-size: 18rpx; font-weight: 800; letter-spacing: 5rpx; }
.title { display: block; margin-top: 20rpx; font-family: Georgia, 'Songti SC', serif; font-size: 53rpx; font-weight: 700; line-height: 68rpx; }
.copy { display: block; margin-top: 22rpx; color: rgba(23, 33, 29, 0.54); font-size: 25rpx; line-height: 42rpx; }
.form-card { margin-top: 54rpx; padding: 26rpx; border: 1rpx solid rgba(23, 33, 29, 0.08); border-radius: 34rpx; background: rgba(255, 253, 248, 0.88); box-shadow: 0 25rpx 60rpx rgba(23, 33, 29, 0.08); }
.field { height: 92rpx; padding: 0 24rpx; border-bottom: 1rpx solid rgba(23, 33, 29, 0.1); color: #17211d; font-size: 26rpx; }
.placeholder { color: rgba(23, 33, 29, 0.36); }
.submit-button { height: 90rpx; margin-top: 26rpx; border-radius: 24rpx; color: #fff; background: #163a2b; font-size: 27rpx; font-weight: 700; }
.submit-button::after { border: none; }
.error-message { display: block; margin-top: 18rpx; color: #b54a35; font-size: 21rpx; text-align: center; }
.hint { display: block; margin-top: 30rpx; color: rgba(23, 33, 29, 0.38); font-size: 20rpx; line-height: 32rpx; text-align: center; }
</style>
