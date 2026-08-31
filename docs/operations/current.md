---
id: operations/documentation
type: current
status: in_progress
last_inspected_at: 2026-09-01
last_verified_at: 2026-09-01
---

# 运维与发布当前状态

- 生产部署入口：`scripts/deploy-production.sh`
- 生产目录：`/opt/lumino`
- 进程：`lumino-backend`、`lumino-frontend`，由 PM2 管理。
- 发布门禁：必须是干净的 `master`，按差异执行迁移、构建、PM2 重启和本机健康检查。
- 当前能力：ESA 只读验证与公网性能基线已有独立脚本，前端构建使用原子目录，Nginx 性能配置由部署脚本可重复生成。
- 当前缺口：本地测试、文档校验和生产冒烟尚未统一为一个总入口；发布后证据仍需人工写入结果文档。
- 现有正式 Runbook：`docs/operations/production-deployment-runbook.md`。
- 最近一次文档审计：`docs/operations/2026-08-28-documentation-audit.md`。
- ESA 接入后的访问与刷新性能计划：`docs/operations/2026-08-31-esa-performance-optimization-plan.md`。
- 性能阶段 0 至 4 的已选低中风险项目已发布生产并完成公网验证，证据见 ESA 与博客 `walkthrough.md`；未实施的高风险结构性项目仍保留在性能计划中。

目标入口见 `docs/README.md` 的“统一验证入口”。
