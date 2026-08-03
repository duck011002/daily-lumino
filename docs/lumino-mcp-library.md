# Lumino 书房 MCP

书房 MCP 是与博客 MCP 完全独立的 Streamable HTTP 服务：

```text
https://<lumino-domain>/api/mcp/library/
```

超级管理员在“书房与个人资料 → AI 助手”中创建专用凭据。令牌只显示一次，可以随时停用；不要使用登录 Cookie、管理员密码或博客 MCP 令牌替代。

MCP 的修改会直接保存并立即生效。公开范围仍由资料中的 `show_email`、`status_public`，以及链接和收藏卡片的 `is_public` 控制。创建链接和收藏卡片时默认公开，若希望隐藏，应明确传入 `is_public=false`。

当前工具包括：

- 读取完整书房资料；
- 更新个人资料字段；
- 新增或修改外部链接；
- 查询、新增或修改收藏卡片；
- 上传书房图片。

第一版不提供删除工具。修改已有卡片前应先查询卡片 ID；图片应先上传，再把返回的公网 URL 写入对应字段。

Codex 连接示例：

```bash
codex mcp add lumino-library --url https://<lumino-domain>/api/mcp/library/ --bearer-token-env-var LUMINO_LIBRARY_MCP_TOKEN
```
