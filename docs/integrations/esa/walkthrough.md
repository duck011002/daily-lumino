---
id: integration/esa
type: walkthrough
status: verified
last_verified_at: 2026-09-01
---

# ESA 结果文档

最近一次公网核验（2026-09-01，`bash scripts/verify-esa.sh`）：

- [x] 根域名 HTTPS 200，响应服务器为 ESA
- [x] 测试子域 HTTPS 200，响应服务器为 ESA
- [x] `/api/health`、`/api/blog/featured`、`/api/site/profile` 为 `private, no-store` 和 `DYNAMIC`
- [x] `/sw.js` 为 `no-store` 和 `DYNAMIC`
- [x] `/icons/icon-192.png` 为 `public, max-age=2592000, immutable`，实测 ESA `HIT`
- [x] `/_next/static/*` 为一年不可变缓存
- [x] 匿名 `/api/public/site-profile` 首次 `MISS`、重复请求 `HIT`，`X-Swift-CacheTime: 60`
- [x] 公共 API 不同查询参数首次分别 `MISS`，没有串缓存
- [x] 同一公共 API 带 Cookie 时为 `DYNAMIC`
- [x] 新文章详情 `/api/public/blog/posts/{slug}` 首次 `MISS`、第二次 `HIT`
- [x] 文章详情返回 gzip，且只有一个 `Vary: Accept-Encoding`
- [x] 浏览量写接口 `/api/blog/posts/{slug}/view` 返回 204
- [x] 仓库与生产 Nginx 均未发现源站 `limit_req`、`limit_conn` 或应用层单 IP 限流，避免把邮件节流误记为访问限流
- [x] 用户确认 ESA 已配置单 IP 200 次/10 秒边缘限流

已自动化：

- [x] 将动态路径、静态资源、公共 API 命中、TTL、查询参数和 Cookie 隔离固化为 `scripts/verify-esa.sh`

脱敏响应头摘要：

```text
GET /api/public/blog/posts/{slug}?esa_probe=...
first:  200, MISS, Cache-Control s-maxage=60, gzip, Vary: Accept-Encoding
second: 200, HIT,  Age: 0, X-Swift-CacheTime: 60
POST /api/blog/posts/{slug}/view: 204
```

生产发布：`cf963b187df21b64f763530dfb6bf3822390d395`，前后端 PM2 `online`，`/api/health` 与本机前端均为 200。

仍待自动化：每次生产发布后把脱敏验证摘要自动写入发布报告。目前验证脚本会失败即返回非零，但不会自动提交文档。

限流验证说明：本次没有发送 201 次突发请求。低频回归证明正常用户请求未被误伤，但不能独立证明超阈值后的动作；ESA 控制台命中日志或后续受控测试才是阻断验证证据。
