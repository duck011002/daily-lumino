---
id: integration/esa
type: walkthrough
status: verified
last_verified_at: 2026-08-31
---

# ESA 结果文档

最近一次公网核验（2026-08-31，`bash scripts/verify-esa.sh`）：

- [x] 根域名 HTTPS 200，响应服务器为 ESA
- [x] 测试子域 HTTPS 200，响应服务器为 ESA
- [x] `/api/health`、`/api/blog/featured`、`/api/site/profile` 为 `private, no-store` 和 `DYNAMIC`
- [x] `/sw.js` 为 `no-store` 和 `DYNAMIC`
- [x] `/icons/icon-192.png` 为 `public, max-age=2592000, immutable`，实测 ESA `HIT`
- [x] `/_next/static/*` 为一年不可变缓存

已自动化：

- [x] 将以上检查固化为 `scripts/verify-esa.sh`

待完成：

- [ ] 保存脱敏响应头摘要和执行时间
- [ ] 每次生产发布后自动运行并追加 commit

性能优化阶段 1A 已在本地完成并通过 Service Worker 生成产物测试，但尚未发布生产；当前公网 `/sw.js` 仍是本次修改前基线。
