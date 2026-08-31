---
id: feature/library
type: current
status: implemented
last_inspected_at: 2026-08-28
last_verified_at: null
---

# 书房（Library）当前状态

- 路由：`/library`
- 主要接口：`/api/site/profile`
- 当前行为：读取公开站点资料和 `media_cards`，客户端按类别过滤并展示收藏卡片。
- 权限：公开内容由后端过滤；管理员编辑入口需要登录和 root 权限。
- 性能注意：当前响应包含完整 profile JSON，卡片图片仍需统一缩略图和懒加载策略。
- ESA：页面与 API 保持动态回源；静态图标和 Next 静态资源可由边缘缓存。
