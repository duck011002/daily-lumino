---
id: feature/chat-ai
type: current
status: implemented
last_inspected_at: 2026-08-28
last_verified_at: null
---

# 站内聊天与私有 Agent 当前状态

- 路由：`/chat`、`/chat/[id]`
- 站内聊天使用 HTTP SSE，不使用 WebSocket。
- 私有 Agent 可根据上下文路由到聊天、账本、待办、博客和 Library 能力。
- 工具写入通过行动提案/执行器和行动回执约束，不能仅凭模型文案声称已完成。
- SSE 路径必须禁用代理缓冲、缓存和长时间请求重试。

历史设计参考：`docs/superpowers/specs/2026-08-19-private-agent-routing-design.md`（已标记 `superseded`，不覆盖本文现状）。
