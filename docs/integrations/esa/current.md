---
id: integration/esa
type: current
status: verified
last_verified_at: 2026-08-28
---

# 阿里云 ESA 当前状态

- 根域名：`lovestory1314.fun`
- 源站：ECS `114.55.55.110`
- 当前实测根域名和测试子域均返回 `Server: ESA` 与 `via: ens-cache...`。
- HTML、RSC、API、登录、私有页面和 `sw.js` 为 `DYNAMIC`/`no-store`。
- `/icons/*`、`/_next/static/*` 以及明确公开图片路径使用边缘长缓存。
- 回源使用 HTTPS 443，Host/SNI 固定为根域名。
- ESA 免费版不启用智能路由、边缘函数、边缘存储或按量付费能力。
- 访问统计的数据最小化与回源头要求见 `docs/visit-analytics.md`。
- `.esa-staging/` 是本地、被忽略的暂存材料，不是线上 ESA 配置的权威副本；线上事实必须通过控制台导出或公网响应验证后写入 `walkthrough.md`。

历史切换记录：`docs/ops/esa-rollout-20260731.md`。该文件包含切换前基线，不能单独作为当前状态依据。
