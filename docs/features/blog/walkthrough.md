---
id: feature/blog
type: walkthrough
status: verified
last_verified_at: 2026-09-01
---

# 博客结果文档

本轮性能验收：

- [x] 公共精选响应使用卡片模型，不含正文；生产压缩样本由旧接口约 14,425 B 降到约 1,940 B，下降约 86.6%。
- [x] 公共详情连续 GET 不修改 `view_count`；显式 POST 后只增加 1，缺失文章返回 404。
- [x] 线上公共详情首次 `MISS`、重复请求 `HIT`，边缘 TTL 60 秒。
- [x] 公共详情带 Cookie 时由全站 ESA 脚本确认绕过公共缓存。
- [x] 线上浏览量 POST 返回 204，前端按文章 30 分钟去重。
- [x] 博客页面、旧兼容接口和私有边界保持回归通过。
- [x] 删除接口和“撤销创建文章”改为软删除，物理行保留、`deleted_at` 写入、精选状态清除。
- [x] 公开分页、详情、浏览量、作者/管理员列表、站点摘要、用户文章计数与 Lumino MCP 均隐藏软删除文章。
- [x] 精确生产脚本只接受 ID + slug 目标，校验操作前总数，默认 dry-run；已移除会批量物理删除文章的旧脚本。

验证命令：

```text
backend: pytest -q -> 152 passed
frontend: npx tsc --noEmit, npm run lint, npm run build -> passed
edge: bash scripts/verify-esa.sh -> passed
```

## 生产软删除验收（2026-09-01）

- 部署提交：`51863c7f8e1754fde5541b2b7105bc682050fcba`；Alembic：`e3b7c1d9a204 (head)`。
- dry-run：有效文章总数 22，精确目标只有 ID 12、25，ID 与 slug 均匹配。
- apply：只为 ID 12、25 写入 `deleted_at`，有效文章总数由 22 变为 20；没有执行物理删除。
- Lumino MCP 回读：20 篇有效文章，ID 12、25 不再返回，ID 26 与其余 19 篇仍在。
- ESA 公网回归：ID 12、25 的公共详情返回 404；新文 ID 26 以及随机抽查的旧文 ID 23、24 返回 200。
- 服务回归：`/api/health` 返回 `status=ok`；前后端 PM2 均为 `online`；`scripts/verify-esa.sh` 全部通过。

ESA 的公共 API 最长可能保留 60 秒旧缓存，因此上述详情验收使用唯一查询参数绕开已存在的缓存对象；后续无参数请求会在 TTL 到期后与源站状态一致。

待后续量化：分类快速切换时的取消请求数、相同网络下 LCP/CLS 多次采样，以及发布后主动 purge。短 TTL 已保证没有 purge 时的最终一致性。
