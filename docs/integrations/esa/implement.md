---
id: integration/esa
type: implementation
status: verified
---

# ESA 接入实施文档

完整历史方案见 `docs/ops/esa-rollout-20260731.md`。

核心设计：保留 ECS 快速回滚；ESA 采用 CNAME 接入；动态内容默认绕过缓存；只对白名单图片、图标、Workbox 和带 hash 的 Next 静态资源缓存；源站 Nginx 以 `no-store` 作为第二道保护；SSE 禁止缓冲和缓存。
