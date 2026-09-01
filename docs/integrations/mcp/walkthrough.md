---
id: integration/mcp
type: walkthrough
status: verified
last_verified_at: 2026-09-01
codex_plugin_status: installed
---

# Lumino MCP 结果文档

已完成或已记录：

- [x] 统一 Lumino MCP 端点与旧 Blog/Library MCP 兼容设计
- [x] Token 最小权限、用户绑定、停用和哈希存储
- [x] 账本、待办、博客、Library 的行动执行与撤销边界
- [x] 统一 AI/账本/MCP 发布验收文档
- [x] Codex 已配置统一 Lumino、兼容 Blog 与 Library 三个连接
- [x] 真实调用统一 MCP `list_blog_posts` 成功，返回绑定作者的文章列表
- [x] 真实调用 Blog MCP `list_blog_categories` 成功，返回 `performance` 等公开分区
- [x] 调用脚本只从环境变量读取 Bearer Token，输出文件不含 Token
- [x] Blog MCP 连续上传 3 张脱敏工作区验证截图，三个公网图片地址均返回 200
- [x] 统一 Lumino MCP `create_blog_post` 创建文章 ID 26，行动 ID 5，并通过发布行动 ID 6 自动公开
- [x] 通过公共详情接口回读文章 ID、公开状态、正文限流说明；博客页面与三张图片均返回 200

发布文章：`/blog/lumino-esa-edge-performance-rate-limit-rollout-20260901`。

删除旧文章不属于当前 MCP 暴露工具，将使用生产数据库的精确 ID 事务执行，并单独记录删除前后计数。

项目内发布结果见 `docs/operations/2026-08-19-unified-ai-ledger-mcp-release.md`。
