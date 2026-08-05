<template>
  <view class="app-shell">
    <view class="status-space" />

    <view class="topbar">
      <view class="brand">
        <text class="back-arrow" @tap="goBack">←</text>
        <text class="brand-name">待办与灵感清单</text>
      </view>
      <view class="round-button" @tap="requestNotification">🔔</view>
    </view>

    <scroll-view class="content-scroll" scroll-y>
      <view class="content">
        <!-- 提醒 Banner -->
        <view class="notify-banner">
          <text class="banner-title">🔔 系统提醒通知</text>
          <text class="banner-sub">开启系统通知权限，定时为您提醒待办事项与健康打卡</text>
          <button class="banner-btn" @tap="requestNotification">开启/管理通知</button>
        </view>

        <!-- 新建待办 -->
        <view class="create-card">
          <text class="card-title">✨ 快速记录灵感或待办</text>
          <input
            v-model="title"
            class="input-field"
            placeholder="需要完成的事项..."
            confirm-type="done"
            @confirm="handleCreate"
          />
          <view class="priority-row">
            <text
              v-for="p in priorities"
              :key="p.key"
              class="priority-chip"
              :class="{ active: priority === p.key }"
              @tap="priority = p.key"
            >
              {{ p.label }}
            </text>
            <button class="submit-btn" @tap="handleCreate">添加</button>
          </view>
        </view>

        <!-- 待办列表 -->
        <view v-if="loading" class="empty-tip">加载待办事项中...</view>
        <view v-else-if="todos.length === 0" class="empty-tip">暂无待办事项，喝杯茶休息一下吧。</view>
        <view v-else class="todo-list">
          <view
            v-for="item in todos"
            :key="item.id"
            class="todo-item"
            :class="{ completed: item.status === 'completed' }"
          >
            <view class="check-box" @tap="toggleStatus(item)">
              <text v-if="item.status === 'completed'">✓</text>
            </view>
            <view class="todo-info">
              <text class="todo-title">{{ item.title }}</text>
              <text v-if="item.source_url" class="source-link" @tap="openUrl(item.source_url)">🔗 来源外链</text>
            </view>
            <text class="delete-btn" @tap="handleDelete(item.id)">✕</text>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getTodos, createTodo, updateTodo, deleteTodo } from '../../services/api.js'

const todos = ref([])
const loading = ref(true)
const title = ref('')
const priority = ref('medium')

const priorities = [
  { key: 'low', label: '低优' },
  { key: 'medium', label: '中优' },
  { key: 'high', label: '高优' },
]

const loadData = async () => {
  loading.value = true
  try {
    const data = await getTodos()
    todos.value = data || []
  } catch (err) {
    uni.showToast({ title: '加载待办失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
})

const goBack = () => {
  uni.navigateBack({
    fail() {
      uni.reLaunch({ url: '/pages/index/index' })
    }
  })
}

const requestNotification = () => {
  // #ifdef APP-PLUS
  plus.push.getClientInfo()
  uni.showToast({ title: '已挂载系统消息通知权限', icon: 'success' })
  // #endif
  // #ifndef APP-PLUS
  uni.showToast({ title: '系统提醒功能准备就绪', icon: 'none' })
  // #endif
}

const handleCreate = async () => {
  if (!title.value.trim()) return
  try {
    await createTodo({ title: title.value.trim(), priority: priority.value })
    title.value = ''
    loadData()
  } catch (err) {
    uni.showToast({ title: '创建失败', icon: 'none' })
  }
}

const toggleStatus = async (item) => {
  const nextStatus = item.status === 'pending' ? 'completed' : 'pending'
  try {
    await updateTodo(item.id, { status: nextStatus })
    loadData()
  } catch (err) {
    uni.showToast({ title: '更新失败', icon: 'none' })
  }
}

const handleDelete = async (id) => {
  try {
    await deleteTodo(id)
    loadData()
  } catch (err) {
    uni.showToast({ title: '删除失败', icon: 'none' })
  }
}

const openUrl = (url) => {
  uni.setClipboardData({
    data: url,
    success() {
      uni.showToast({ title: '链接已复制', icon: 'none' })
    }
  })
}
</script>

<style scoped>
.app-shell {
  min-height: 100vh;
  background-color: #F1EEE5;
  color: #1c2b26;
  display: flex;
  flex-direction: column;
}
.status-space {
  height: var(--status-bar-height, 24px);
}
.topbar {
  height: 52px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}
.back-arrow {
  font-size: 20px;
  font-weight: bold;
}
.brand-name {
  font-size: 17px;
  font-weight: bold;
}
.round-button {
  width: 36px;
  height: 36px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
}
.content-scroll {
  flex: 1;
}
.content {
  padding: 16px;
}
.notify-banner {
  background: linear-[#fff7ed], #fff;
  border: 1px solid #fed7aa;
  border-radius: 20px;
  padding: 16px;
  margin-bottom: 16px;
}
.banner-title {
  font-weight: bold;
  font-size: 15px;
  display: block;
}
.banner-sub {
  font-size: 12px;
  color: #64748b;
  margin: 6px 0 12px 0;
  display: block;
}
.banner-btn {
  background: #ea580c;
  color: #fff;
  font-size: 12px;
  border-radius: 12px;
  padding: 0 12px;
  height: 32px;
  line-height: 32px;
  display: inline-block;
}
.create-card {
  background: rgba(255,255,255,0.85);
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  padding: 16px;
  margin-bottom: 16px;
}
.card-title {
  font-size: 14px;
  font-weight: bold;
  margin-bottom: 10px;
  display: block;
}
.input-field {
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  padding: 8px 12px;
  font-size: 14px;
  margin-bottom: 12px;
}
.priority-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.priority-chip {
  padding: 4px 10px;
  border-radius: 10px;
  font-size: 12px;
  background: #e2e8f0;
}
.priority-chip.active {
  background: #047857;
  color: #fff;
}
.submit-btn {
  margin-left: auto;
  background: #047857;
  color: #fff;
  font-size: 12px;
  border-radius: 10px;
  padding: 0 14px;
  height: 30px;
  line-height: 30px;
}
.empty-tip {
  text-align: center;
  color: #94a3b8;
  padding: 40px 0;
  font-size: 14px;
}
.todo-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.todo-item {
  background: rgba(255,255,255,0.9);
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.todo-item.completed {
  opacity: 0.6;
  text-decoration: line-through;
}
.check-box {
  width: 24px;
  height: 24px;
  border-radius: 12px;
  border: 2px solid #10b981;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #10b981;
  font-weight: bold;
}
.todo-info {
  flex: 1;
}
.todo-title {
  font-size: 14px;
  font-weight: 500;
}
.source-link {
  font-size: 11px;
  color: #d97706;
  margin-top: 2px;
  display: block;
}
.delete-btn {
  color: #94a3b8;
  font-size: 16px;
  padding: 4px;
}
</style>
