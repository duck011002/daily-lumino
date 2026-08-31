# Lumino 项目文档中心

本目录采用“文档即代码、证据即数据、脚本即门禁”的管理方式。

本套治理规则由全局 Skill `$project-docs-governance` 提供，默认不自动启用；只有明确调用该 Skill 或明确要求文档治理时，才执行下面的审计、索引和验证流程。小型项目无需因此创建完整目录。

## 阅读顺序

Agent 或开发者接手任务时，按以下顺序阅读：

1. `project-state.yaml`：项目当前状态摘要。
2. `catalog.yaml`：功能、集成和运维文档索引。
3. 对应目录的 `current.md`：现在的真实状态。
4. 对应目录的 `walkthrough.md`：最近一次实施、部署或验收事实。
5. 对应目录的 `implement.md`：设计意图、范围和验收标准。

## 目录约定

```text
docs/
  features/       产品功能域
  integrations/   ESA、MCP、图床等外部集成
  milestones/     关键发布节点与版本结果
  operations/     生产运维、测试、部署和回滚
  decisions/      架构决策记录（ADR）
  evidence/       脱敏后的验证摘要与原始证据索引
  archive/        已被替代的历史文档
```

现有 `docs/superpowers/`、日期命名的旧发布记录和 `docs/ops/` 暂不移动，以免破坏链接；它们属于历史设计、执行计划或证据，不是当前任务队列。先查看文档顶部状态，再按 `catalog.yaml` 中的 `current` 路径确认现状。完整映射见 `archive/README.md`。

## 状态定义

- `planned`：已计划，尚未开始。
- `in_progress`：实施中。
- `blocked`：被外部条件或未决事项阻塞。
- `implemented`：代码或配置已完成，但未完成全部验证。
- `pending_verification`：实现或结果已记录，但仍等待可复现的验证证据。
- `partially_verified`：部分环境、链路或功能已验证。
- `verified`：实现、部署和验收均有证据。
- `rolled_back`：曾上线，随后回滚。
- `superseded`：已被新方案替代。
- `deprecated`：已废弃，仅保留历史参考。

`implemented` 不等于 `verified`。没有命令、时间、commit 和证据的“已完成”不能作为线上事实。

`last_inspected_at` 只表示最近一次源码/文档巡检；`last_verified_at` 必须对应可复现的本地、测试环境或生产验证证据，不能用巡检时间代替。

## 文档更新规则

- 设计前更新 `implement.md`，状态改为 `in_progress`。
- 实施、测试、部署后更新 `walkthrough.md`，记录实际结果和偏差。
- 线上状态变化后更新 `current.md` 与 `project-state.yaml`。
- 外部系统（ESA、DNS、MCP 客户端）必须写明“已配置”和“已验证”的边界。
- 历史文档不删除，改为 `superseded` 或 `deprecated`，并从 `current.md` 链接过去。
- 历史计划中的未勾选任务不自动等于当前待办；是否仍需实施由对应 `current.md` 和 `walkthrough.md` 决定。
- 凭据、Cookie、API Key、MCP Token 和完整私人内容不得进入文档或证据文件。

## 统一验证入口（目标）

```bash
./scripts/lumino test all
./scripts/lumino verify docs
./scripts/lumino verify esa
./scripts/lumino smoke production
./scripts/lumino deploy production
```

这些入口逐步建设完成前，仍以现有 `scripts/deploy-production.sh` 和各目录中的原有命令为准。
