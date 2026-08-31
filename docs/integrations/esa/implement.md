---
id: integration/esa
type: implementation
status: verified
last_verified_at: 2026-09-01
---

# ESA 接入实施文档

完整历史方案见 `docs/ops/esa-rollout-20260731.md`。

核心设计：保留 ECS 快速回滚；ESA 采用 CNAME 接入；动态内容默认绕过缓存；只对白名单图片、图标、Workbox、带 hash 的 Next 静态资源和独立的匿名公共 API 缓存；源站 Nginx 以响应头作为第二道保护；SSE 禁止缓冲和缓存。

实施约束：

- `/api/public/**` 必须是无身份依赖、无副作用、无 `Set-Cookie` 的只读接口。
- 公共接口由源站返回 `s-maxage=60, stale-while-revalidate=120`，ESA 遵循源站头。
- 浏览器公共请求不携带凭据；带 Cookie 或 Authorization 的请求必须优先命中绕过规则。
- 查询参数保留在缓存键中，分类、分页、搜索和探针不得串缓存。
- 页面导航、RSC、API 和私有数据在 Service Worker 中使用 `NetworkOnly`；只有带 hash 的 Next 静态资源使用 `CacheFirst`。
- Nginx 对文本启用 gzip，由 `gzip_vary` 生成唯一的 `Vary: Accept-Encoding`，SSE 不压缩。
- 生产前端在 `.next-build` 构建，成功后才替换 `.next`；构建失败时继续保留旧版本。

可重复核验入口：`bash scripts/verify-esa.sh`。
