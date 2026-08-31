---
id: feature/auth-invite
type: current
status: implemented
last_inspected_at: 2026-08-28
last_verified_at: null
---

# 认证与邀请申请当前状态

- 路由：`/login`、`/register`、`/invite-request`
- 认证由 Cookie、访问/刷新 Token 和 `/api/auth/me` 支撑。
- 邀请申请包含邮箱验证、管理员审核和过期状态。
- 登录、注册、邀请申请和刷新接口必须 `private, no-store`，不得被 ESA 或 Service Worker 缓存。
- 历史设计记录：`docs/superpowers/specs/2026-06-05-invite-request-design.md`（已标记 `superseded`，不覆盖本文现状）。
