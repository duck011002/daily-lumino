---
id: feature/blog
type: current
status: verified
last_inspected_at: 2026-09-01
last_verified_at: 2026-09-01
---

# 博客当前状态

- 路由：`/blog`、`/blog/[slug]`、`/blog/manage`、`/blog/write`
- 兼容接口：`/api/blog/categories`、`/api/blog/featured`、`/api/blog/posts-page`、`/api/blog/posts/{slug}`
- 边缘可缓存只读接口：`/api/public/blog/categories`、`/api/public/blog/featured`、`/api/public/blog/posts-page`、`/api/public/blog/posts/{slug}`
- 列表：默认分页 9 条；搜索、分类和精选均由客户端组件触发请求。
- 详情：正文从只读公共接口加载；浏览量由 `/api/blog/posts/{slug}/view` 显式写入，浏览器按文章 30 分钟去重。
- 删除：`blog_posts.deleted_at` 记录软删除时间；公开、管理、摘要和 MCP 列表均只返回 `deleted_at IS NULL` 的文章，删除时同时取消精选状态，数据库实体仍保留。
- 性能注意：列表首页存在分类、分页和精选多请求；分页服务还会额外查询精选 ID。
- ESA：博客 HTML 和 RSC 保持 DYNAMIC；匿名 `/api/public/blog/**` 使用 60 秒边缘缓存；Cookie 请求绕过缓存。

历史发布记录：`docs/operations/2026-07-27-blog-mcp-and-domain.md`。

## 2026-09-01 ESA 文章整理边界

- 新文章：ID 26，`lumino-esa-edge-performance-rate-limit-rollout-20260901`。
- 仅允许软删除两篇被新文替代的旧 ESA 文章：ID 12 和 ID 25。
- 其他文章和草稿禁止删除；本次生产操作使用“ID + slug + 操作前有效总数”三重校验脚本，默认仅 dry-run。
