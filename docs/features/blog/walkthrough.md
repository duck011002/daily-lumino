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

验证命令：

```text
backend: pytest -q -> 150 passed
frontend: npx tsc --noEmit, npm run lint, npm run build -> passed
edge: bash scripts/verify-esa.sh -> passed
```

待后续量化：分类快速切换时的取消请求数、相同网络下 LCP/CLS 多次采样，以及发布后主动 purge。短 TTL 已保证没有 purge 时的最终一致性。
