---
id: documentation/archive-index
type: index
status: implemented
last_reviewed_at: 2026-08-28
---

# 历史文档与旧入口说明

为避免破坏仓库链接，历史文档第一阶段不做物理移动，而是在原文件顶部标记状态和新的权威入口。本目录负责解释旧文档的用途，不把它们重新定义为当前事实。

## Agent 判断规则

1. `docs/project-state.yaml` 与 `docs/catalog.yaml` 决定当前阅读入口。
2. 各功能或集成的 `current.md` 描述现状，`walkthrough.md` 记录最近证据。
3. `docs/superpowers/plans/` 中的复选框只代表原计划书状态，不是当前待办。
4. `docs/superpowers/specs/` 是历史设计依据；若与当前代码或 `current.md` 冲突，以后两者为准，并补充新的决策记录。
5. 日期命名的运维和发布文档是时间截面，不能用其中的“当前”推断今天的状态。
6. `.esa-staging/` 是本地、被忽略的暂存材料，不是 ESA 线上配置的权威副本。

## 旧文档映射

| 旧文档 | 保留用途 | 当前入口 |
| --- | --- | --- |
| 根目录 `README.md` | v1.0 功能演示与早期测试说明 | `docs/README.md` |
| 根目录 `TODO.md` | 邀请申请流的早期规划 | `docs/features/auth-invite/current.md` |
| 根目录 `lumino_实施文档_v1.1_Codex版.md` | 从零搭建阶段的执行基线 | `docs/README.md` |
| 根目录 `Lumino_安全与性能UI评审报告.md` | 2026-06-05 设计层安全、性能和 UI 评审 | `docs/project-state.yaml` |
| `docs/ops/esa-rollout-20260731.md` | ESA 切换前基线、操作和回滚证据 | `docs/integrations/esa/current.md` |
| `docs/operations/2026-07-27-blog-mcp-and-domain.md` | 当日博客、域名和 MCP 发布记录 | 博客、MCP、ESA 对应的 `current.md` |
| `docs/superpowers/plans/*` | 原实施拆解与测试思路 | `docs/catalog.yaml` 指向的功能目录 |
| `docs/superpowers/specs/*` | 原设计决策背景 | 对应功能的 `implement.md` |
| `docs/mobile-app-design.md` | 早期 Android 设计稿 | `docs/features/mobile-app/current.md` |
| `docs/visit-analytics.md` | 访问分析规则与 ESA 回源要求 | `docs/integrations/esa/current.md` |

## 后续归档原则

- 不删除仍能解释历史决策或提供回滚依据的文档。
- 只有在全仓引用完成迁移后，才考虑把旧文件移动到本目录。
- 新文档替代旧文档时，在旧文件写入 `status: superseded` 和 `source_of_truth`。
- 原始证据必须脱敏；域名、响应头摘要和 commit 可保留，密钥、Token、Cookie 和私人数据不得归档。
