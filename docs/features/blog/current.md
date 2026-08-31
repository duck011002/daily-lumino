---
id: feature/blog
type: current
status: implemented
last_inspected_at: 2026-08-28
last_verified_at: null
---

# 博客当前状态

- 路由：`/blog`、`/blog/[slug]`、`/blog/manage`、`/blog/write`
- 公开接口：`/api/blog/categories`、`/api/blog/featured`、`/api/blog/posts-page`、`/api/blog/posts/{slug}`
- 列表：默认分页 9 条；搜索、分类和精选均由客户端组件触发请求。
- 详情：动态加载 Markdown preview；公开详情读取时会同步增加 `view_count`。
- 性能注意：列表首页存在分类、分页和精选多请求；分页服务还会额外查询精选 ID。
- ESA：博客 HTML、RSC、公开 API 当前保持 DYNAMIC；公开静态图片按白名单缓存。

历史发布记录：`docs/operations/2026-07-27-blog-mcp-and-domain.md`。
