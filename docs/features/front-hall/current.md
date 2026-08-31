---
id: feature/front-hall
type: current
status: implemented
last_inspected_at: 2026-08-28
last_verified_at: null
---

# 前厅（首页）当前状态

- 路由：`/`
- 共用组件：`frontend/src/components/layout/SiteNav.tsx`
- 主要接口：`/api/site/profile`、`/api/blog/featured`
- 当前行为：客户端并行读取站点资料和精选博客，首屏展示个人资料、精选文章和收藏预览。
- 图片：资料封面、头像、精选文章使用远程图片；性能改造前仍需统一缩略图和尺寸策略。
- ESA：当前 HTML 与 API 走动态回源，不应默认假设边缘缓存命中。

详细设计见 `implement.md`，最近一次实际验证见 `walkthrough.md`。
