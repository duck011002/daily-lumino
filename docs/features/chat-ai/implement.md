---
id: feature/chat-ai
type: implementation
status: implemented
---

# 站内聊天与私有 Agent 实施文档

## 设计要点

- 先生成结构化行动计划，再由领域服务执行。
- 每个模块入口限制可用工具范围。
- 写操作返回标准化行动回执，支持幂等与撤销。
- 模型超时、网络失败、产品未开通、限流和权限不足必须区分。
- SSE 回源使用独立 Nginx location，`proxy_buffering off`、`proxy_cache off`。

## 验收标准

- 无行动回执时不得展示“已完成”。
- 批量行动逐项返回结果，权限和用户隔离有效。
- 流式输出可逐字到达，断开后不会重复执行写操作。
