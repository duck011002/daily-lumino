---
id: operations/documentation
type: current
status: in_progress
last_inspected_at: 2026-08-31
last_verified_at: null
---

# 运维与发布当前状态

- 生产部署入口：`scripts/deploy-production.sh`
- 生产目录：`/opt/lumino`
- 进程：`lumino-backend`、`lumino-frontend`，由 PM2 管理。
- 发布门禁：必须是干净的 `master`，按差异执行迁移、构建、PM2 重启和本机健康检查。
- 当前缺口：ESA 只读验证与公网性能基线已有独立脚本，本地测试、文档校验和生产冒烟尚未统一为一个总入口。
- 现有正式 Runbook：`docs/operations/production-deployment-runbook.md`。
- 最近一次文档审计：`docs/operations/2026-08-28-documentation-audit.md`。
- ESA 接入后的访问与刷新性能计划：`docs/operations/2026-08-31-esa-performance-optimization-plan.md`。
- 性能第一批：阶段 0 与 1A 已本地实现并通过构建，尚未发布生产；不得把本地完成状态写成线上已验证。

目标入口见 `docs/README.md` 的“统一验证入口”。
