---
id: integration/mcp
type: implementation
status: implemented
---

# Lumino MCP 实施文档

完整设计见：

- `docs/superpowers/specs/2026-08-19-unified-ai-ledger-mcp-design.md`
- `docs/superpowers/specs/2026-08-19-private-agent-routing-design.md`
- `docs/lumino-mcp-chatgpt.md`

实施边界：MCP 服务、Token、权限、幂等、行动回执和旧端点兼容属于项目代码；将 MCP 安装为 Codex 可调用连接属于外部客户端配置，必须另行记录安装方式、权限和回归结果。
