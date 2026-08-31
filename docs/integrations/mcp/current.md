---
id: integration/mcp
type: current
status: implemented
last_verified_at: 2026-08-19
codex_plugin_status: not_installed
---

# Lumino MCP 当前状态

这里的 MCP 指项目内已实现的 Lumino MCP 服务，不等同于 Codex 插件。

- 统一端点：`/api/mcp/lumino/`
- 兼容端点：Blog MCP、Library MCP 继续保留。
- 能力覆盖：博客、Library、账本、待办，以及统一行动/撤销能力。
- Token：后端只保存哈希，按用户绑定和最小权限范围签发。
- 安全：普通用户不能获取 Library 作用域；博客自动发布受权限和开关控制。
- Codex 状态：尚未安装进 Codex，因此当前不能把“项目内 MCP 已实现”描述成“Codex 已可调用”。

详细接入说明：`docs/lumino-mcp-chatgpt.md`。
