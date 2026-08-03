# Lumino Blog MCP 接入 ChatGPT 网页版

## 服务端

Lumino 的博客 MCP 位于分支 `codex/sync-server-20260727`，采用 Streamable HTTP，部署地址为：

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

随后在 Lumino 的超级管理员后台创建专用 MCP 凭据。令牌只会显示一次；请使用专用、可撤销的令牌，且首轮保持“自动发布”关闭。MCP 提供分类查询、图片上传、文章创建、读取、修改和显式发布工具。

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
