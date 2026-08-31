---
id: milestone/2026-08-28-current-release
type: milestone
status: partially_verified
date: 2026-08-28
commit: 8519dc653b8c12d21a9920bc1fb35a427a6620cd
---

# 2026-08-28 当前发布节点

## 已纳入

- 全站中英文静态界面切换
- ESA 线上状态重新核验并建立当前状态档案
- 项目文档管理模式初始化
- Lumino MCP 文档独立归档，明确项目服务与 Codex 安装状态的边界

## 当前状态

- 双语切换：`partially_verified`，类型检查和 Lint 已完成，生产全路由验收待补。
- ESA：`verified`，根域名和测试子域均已通过公网响应头核验。
- 项目文档治理：`in_progress`，目录和索引已建立，统一脚本入口待实现。
- Codex MCP 安装：`not_installed`，不影响项目内 MCP 服务运行。

## 下一步

- 建立 `scripts/lumino` 统一调度器。
- 固化 ESA、生产冒烟和文档状态检查脚本。
- 为各功能的 pending walkthrough 补充真实测试命令、commit、时间和脱敏证据。
