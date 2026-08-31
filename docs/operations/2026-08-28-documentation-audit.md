---
id: operations/documentation-audit-20260828
type: audit
status: verified
last_verified_at: 2026-08-28
---

# 旧文档干扰审计（2026-08-28）

## 结论

仓库没有发现需要删除的历史文档，但发现多处“历史内容看起来像当前事实或当前待办”的风险。第一阶段采用原路径保留、顶部加状态、补充权威入口和集中索引的方式处理，避免破坏已有链接。

## 已处理项

| 文档类型 | 风险 | 处理 |
| --- | --- | --- |
| 根目录 README、旧 v1.1 实施文档 | 阶段性说明和 Codex 执行规则容易被当成现行规则 | 加历史提示，当前入口改为 `docs/README.md`、`project-state.yaml` 和 `catalog.yaml` |
| `TODO.md`、`docs/superpowers/plans/*` | 未勾选复选框容易被当成当前待办 | 标记 `superseded`，指向对应功能 `current.md` |
| `docs/superpowers/specs/*` | 旧设计目标可能覆盖当前代码事实 | 标记为历史设计参考，指向对应 `implement.md`/`current.md` |
| ESA 2026-07-31 接入记录 | 切换前 DNS 基线与后续 ESA 验证混在同一时间截面 | 标记为历史 rollout，当前状态以 ESA `current.md`/`walkthrough.md` 为准 |
| 2026-07-27 运维记录 | 域名、部署和 MCP 状态已发生变化 | 标记为历史发布记录 |
| 移动端审核稿与 README | “待审核”与已有源码、APK 产物互相矛盾 | 新增移动端三件套；当前标记为“实现存在、发布验证待补齐” |
| 访问分析与 ESA 暂存目录 | 规则文档和本地暂存材料的权威性边界不清 | 链接到 ESA 当前状态，并明确 `.esa-staging/` 不是线上事实来源 |

## 当前阅读规则

1. 先读 `docs/project-state.yaml` 和 `docs/catalog.yaml`。
2. 再读对应功能或集成的 `current.md`，需要证据时读 `walkthrough.md`。
3. 看到 `superseded`、`deprecated` 或“历史”标记时，不把正文中的未勾选项当成当前待办。
4. 生产部署只遵循 `docs/operations/production-deployment-runbook.md`；日期发布记录只用于追溯。

## 未在本次处理的事项

- 尚未建立 `scripts/lumino`、`scripts/verify-esa.sh` 等统一脚本入口；现有脚本仍是唯一可执行来源。
- 尚未把所有历史文件物理移动到 `docs/archive/`，以避免外部链接和旧引用失效。
- MCP 项目服务已实现，但 Codex 插件尚未安装；两者继续在文档中分开记录。
