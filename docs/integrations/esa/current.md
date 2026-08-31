---
id: integration/esa
type: current
status: verified
last_verified_at: 2026-09-01
---

# 阿里云 ESA 当前状态

- 根域名：`lovestory1314.fun`
- 源站：ECS `114.55.55.110`
- 当前实测根域名和测试子域均返回 `Server: ESA` 与 `via: ens-cache...`。
- HTML、RSC、登录、私有页面、私有 API 和 `sw.js` 为 `DYNAMIC`/`no-store`。
- 匿名 `/api/public/**` 为可缓存只读命名空间，当前边缘 TTL 为 60 秒；同路径带 Cookie 或 Authorization 时为 `DYNAMIC`。
- `/icons/*`、`/_next/static/*`、`/workbox-*` 以及明确公开图片路径使用边缘缓存。
- 回源使用 HTTPS 443，Host/SNI 固定为根域名。
- ESA 免费版不启用智能路由、边缘函数、边缘存储或按量付费能力。
- 访问统计的数据最小化与回源头要求见 `docs/visit-analytics.md`。
- `.esa-staging/` 是本地、被忽略的暂存材料，不是线上 ESA 配置的权威副本；线上事实必须通过控制台导出或公网响应验证后写入 `walkthrough.md`。

## 当前缓存规则

控制台当前实际限制为 5/5 条缓存规则，按优先级依次为：

1. `lumino-core-bypass`：Cookie、Authorization、后台和其他私有路径绕过缓存。
2. `lumino-html-bypass`：页面与动态文档绕过缓存。
3. `lumino-public-images`：明确公开图片缓存。
4. `lumino-cacheable-public`：`/_next/static/`、`/workbox-` 与匿名 `/api/public/` 可缓存，并遵循源站缓存头。
5. `lumino-default-bypass`：其余未明确放行的请求默认绕过缓存。

公共 API 之所以能命中第 4 条，是因为第 1 条不再笼统匹配全部 `/api`；私有 API 仍由第 5 条兜底，带身份信息的请求仍由第 1 条优先拦截。

历史切换记录：`docs/ops/esa-rollout-20260731.md`。该文件包含切换前基线，不能单独作为当前状态依据。
