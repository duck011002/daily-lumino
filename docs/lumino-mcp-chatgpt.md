# Lumino MCP 接入 Codex 与 ChatGPT

## 统一 Lumino MCP

统一端点覆盖绑定用户的账本、待办和博客；超级管理员 Token 还可管理全局 Library。原有 Blog MCP 与 Library MCP 地址继续兼容，不需要迁移已有客户端。

```text
https://<lumino-domain>/api/mcp/lumino/
```

在超级管理员后台的“AI 发布 MCP → 统一 Lumino MCP”中选择绑定用户与最小权限范围并创建凭据。令牌只显示一次，网页前端不会收到该令牌。Library 作用域只允许签发给超级管理员；Blog 作用域要求目标用户有博客权限。MCP 新建博客默认请求公开：只有 Token 同时具备 `blog:publish` 与 `allow_auto_publish` 时才会公开；否则安全降级为私密草稿并返回提示。`update_blog_post` 永远不改变公开/发布状态。

Codex 使用专用环境变量连接，不要把令牌直接写入命令、配置示例、聊天或日志：

```bash
codex mcp add lumino --url https://<lumino-domain>/api/mcp/lumino/ --bearer-token-env-var LUMINO_MCP_TOKEN
```

建议先只授权读取与草稿写入。记账和待办写操作返回 `action_id`，可使用统一 `undo_action` 撤销；重复请求应复用稳定的幂等键。添加 Library 内容前先调用 `search_library_media_cards`；服务端还会归一化标题、作者、年份和 URL，阻止完全重复项，并将同名不同信息识别为冲突。

## 兼容 Blog MCP

Lumino 的博客 MCP 采用 Streamable HTTP，部署地址为：

```text
https://<lumino-domain>/api/mcp/blog/
```

在服务器部署该分支后，执行数据库迁移，并重启后端：

```bash
cd /opt/lumino/backend
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
pm2 restart lumino-backend
```

随后在 Lumino 的超级管理员后台创建专用 MCP 凭据。令牌只会显示一次；请使用专用、可撤销的令牌，且首轮保持“自动发布”关闭。兼容 Blog MCP 的创建工具也默认请求公开：开关关闭时只建私密草稿，开关开启时直接公开；调用方仍可显式传入 `publish=false` 强制创建草稿。修改工具不改变原有状态。

## 网页私人 Agent 与 MCP 的博客边界

- 网页主对话中的每条消息先经过系统 Agent 模型，自动选择普通对话、记账、待办、博客或 Library；模块页入口只开放本模块工具。
- 网页生成新博客时先返回完整私密预览，不写入博客表。用户点击“保存为草稿”或在同一对话明确同意后，才创建私密草稿；取消则不写入。
- MCP 新建博客按上述 Token 策略默认请求公开。这是自动化入口的既定行为，与网页确认后只存草稿并存。
- 无论网页还是 MCP，更新既有博客都不改变 `is_public`、`is_published` 或 `published_at`。

## ChatGPT 网页版

1. 确保 Lumino MCP 地址是公网可访问的 HTTPS 地址，且证书有效。
2. 在 ChatGPT 网页版打开“设置 -> Apps -> Advanced Settings”，开启 Developer mode；工作区账户需要管理员允许此功能。
3. 在“Settings -> Apps -> Create”中新增自定义 App，填写上述 MCP 地址。
4. 认证方式选择 Bearer token，并粘贴刚才创建的 Lumino MCP 令牌。
5. 点击 Scan Tools；发现工具后点击 Create。在聊天中从 Apps 选择 Lumino Blog 后即可使用。

写入/发布类工具需要 ChatGPT Business、Enterprise 或 Edu 的完整 MCP 支持；Pro 目前仅适用于只读/获取类工具。不要把 MCP 暴露在 HTTP 下，也不要使用管理员登录令牌代替专用 MCP 令牌。

## 图床 HTTPS 修复

不要把 `https://<IP>:<port>` 当作长期公网图床地址：公有证书通常不会为裸 IP 签发，浏览器与 ChatGPT 也会拒绝不受信任证书。应使用独立域名，例如 `img.example.com`：

1. 把 `img.example.com` 的 A/AAAA 记录指向服务器；若使用 Cloudflare，图床需要支持的端口或由 Nginx 统一走 443。
2. 使用 Nginx 将 `https://img.example.com` 反向代理到图床内部地址 `http://127.0.0.1:40027`，并用 Let's Encrypt 或 Cloudflare 提供可信 TLS。
3. 在 Lsky 的 `APP_URL` / 站点 URL 中填 `https://img.example.com`，使新上传文件本身就生成正确链接。
4. 在 Lumino 后端环境中设置 `LSKY_PUBLIC_URL=https://img.example.com`，或在系统配置表创建 `lsky_public_url=https://img.example.com`。后者优先，可在线调整。

后端会保留图床返回链接的路径与查询参数，但将协议和主机改为这个 HTTPS 公网地址；若没有配置公网地址且图床仍返回 HTTP，则上传会被拒绝，不会把 ChatGPT 无法读取的链接保存下来。

示例 Nginx 配置：

```nginx
server {
    listen 80;
    server_name img.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name img.example.com;
    ssl_certificate /etc/letsencrypt/live/img.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/img.example.com/privkey.pem;

    client_max_body_size 20m;
    location / {
        proxy_pass http://127.0.0.1:40027;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```
