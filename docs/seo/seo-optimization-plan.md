# Lumino 站点全方位 SEO 优化与安全防护实施方案

## 1. 概述与核心指标

针对 Lumino 个人数字花园（域名：`lovestory1314.fun`）开展全面的 SEO 与网络安全加固，实现以下核心目标：
1. **搜索引擎可收录性与结构化解析**：构建基于 Next.js 14 App Router 的站点级和动态文章级元数据系统，自动注入 Schema.org 结构化数据（JSON-LD），提升在 Google、Bing、百度等搜索引擎中的卡片丰富展现（Rich Snippets）。
2. **规范爬虫协议与动态收录**：提供标准 `robots.txt` 规则以隔离后台/私密路径，并结合后端接口产出动态 `sitemap.xml`。
3. **无障碍与图像索引（Alt 语义化）**：全站图片消灭空 `alt` 标签，强化技术架构图与关键配图的语义描述。
4. **服务器传输与安全加固**：配置 HTTP/2 协议、80 端口 301 强制跳转 HTTPS、Gzip 传输压缩，并启用国际安全标准的 7 大安全响应头。

---

## 2. 前端代码实现规范

### 2.1 根布局全局元数据与 WebSite 结构化数据
- **文件路径**：`frontend/src/app/layout.tsx`
- **核心配置**：
  - `metadataBase`: `new URL('https://lovestory1314.fun')`
  - `title.template`: `%s | Lumino 数字花园`
  - `description`: `一座支持 MCP 博客、MCP Todo、MCP 记账并深度集成 Model Context Protocol 的个人数字庭院，沉淀全栈开发、后端架构与机器学习研究的高价值实践。`
  - `keywords`: 涵盖 `MCP`, `Model Context Protocol`, `MCP博客`, `mcp blog`, `MCP Todo`, `mcp todo`, `MCP记账`, `全栈开发`, `后端架构`, `机器学习`, `FastAPI`, `Next.js` 等高相关度搜索词
  - `alternates.canonical`: `/`
  - `robots`: 启用 `index`, `follow`，并配置 GoogleBot 大图预览与深度抓取策略
  - `openGraph`: 标准化站点名称、中文语言包（`zh_CN`）、分享大图及摘要
  - **Schema.org**：在 `<head>` 注入站点级 `WebSite` JSON-LD，标明站点所有者与定位。

### 2.2 爬虫协议（Robots）
- **文件路径**：`frontend/src/app/robots.ts`
- **规则**：
  - 放行根路径：`allow: '/'`
  - 屏蔽非公开与接口路径：`disallow: ['/api/', '/courtyard', '/admin', '/login', '/register']`
  - 声明索引：`sitemap: 'https://lovestory1314.fun/sitemap.xml'`

### 2.3 动态站点地图（Sitemap）
- **文件路径**：`frontend/src/app/sitemap.ts`
- **规则**：
  - 静态公共路由：`/` (优先级 1.0, 每日更新), `/blog` (优先级 0.9, 每日更新), `/library` (优先级 0.8, 每周更新)。
  - 动态路由：通过 Next.js 服务端拉取后端公开文章接口 `/api/blog/posts`，自动映射出 `/blog/{slug}`，优先级 0.7，具备异常降级机制。

### 2.4 博客文章详情页（Server Component + Client Component）
- **文件路径**：`frontend/src/app/blog/[slug]/page.tsx` & `frontend/src/app/blog/[slug]/BlogPostClient.tsx`
- **架构设计**：
  - 服务端组件负责根据路由参数动态请求 `/api/public/blog/posts/{slug}`。
  - 通过 `generateMetadata` 动态产出带有文章标题、摘要、Canonical 链接及社交卡片图像的元数据。
  - 服务端直接嵌入 `BlogPosting` 类型的 Schema.org JSON-LD。
  - 客户端组件负责无刷新的阅读量上报（含本地 30 分钟防刷去重）、多语言切换、暗色模式切换、原生分享与 Markdown 预览。

### 2.5 图片 Alt 语义增强对照表
在前端所有卡片和正文渲染中，杜绝空 `alt=""`：
- **首页封面图**：`alt="{display_name} 封面图"`
- **博文列表/精选封面**：`alt="{title} - 精选博文封面"`
- **知识库书房封面**：`alt="{display_name} 书房空间封面"`
- **关键技术配图专属映射**：
  - `6a90081e86845.png` ➔ `alt="Firecrawl 与 Playwright 爬取高校导师知识图谱系统架构图"`
  - `6a72f083a38f7.png` ➔ `alt="Lumino 平台全栈架构与双 MCP 设计全景图"`
  - `6a6c149849681.png` ➔ `alt="Codex 学术论文工作流与保版式翻译演示"`
  - `6a6c1283271d3.jpg` ➔ `alt="FRP 持久化运行与公网 SSH 隧道配置图"`

---

## 3. 服务器 Nginx 完整配置

服务器 Nginx 配置文件建议置于 `/etc/nginx/conf.d/lumino.conf`：

```nginx
# 1. 80 端口强制 301 重定向至 HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name lovestory1314.fun www.lovestory1314.fun;

    # 允许 Let's Encrypt 证书续期校验
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://lovestory1314.fun$request_uri;
    }
}

# 2. 443 端口启用 HTTP/2、SSL、Gzip 及 7 大安全响应头
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name lovestory1314.fun;

    # SSL 证书配置
    ssl_certificate /etc/letsencrypt/live/lovestory1314.fun/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/lovestory1314.fun/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Gzip 传输压缩
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 1024;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/x-javascript
        application/xml
        application/xml+rss
        application/ld+json
        image/svg+xml;

    # 7 大核心安全响应头
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:;" always;

    # 前端 Next.js 反向代理（默认 3000 端口）
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 后端 FastAPI 接口反向代理（默认 8000 端口）
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 4. 本地测试与防改坏验证

在 `frontend/` 目录下依次执行：

```bash
# 1. 静态 TypeScript 类型无错校验
npx tsc --noEmit

# 2. Next.js ESLint 规范校验
npm run lint

# 3. 生产环境构建校验
npm run build
```

在本地开发服务运行（`npm run dev`）后可执行检查：
- `http://localhost:3000/robots.txt`：确认状态为 200，内容包含 Sitemap 声明与 Disallow 路由。
- `http://localhost:3000/sitemap.xml`：确认 XML 格式合法，且包含公开文章路径。
- 查看任一文章页源码，检查 `<head>` 中是否存在 `og:title`、`rel="canonical"` 以及 `<script type="application/ld+json">`。

---

## 5. 服务器生效与上线指南

### 5.1 代码提交与推送
```bash
git add frontend/ docs/
git commit -m "feat(seo): implement meta tags, schema.org, robots, sitemap and nginx security headers"
git push origin master
```

### 5.2 Nginx 配置重载
在生产服务器上检查并热重载 Nginx：
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 5.3 线上验证命令
```bash
# 验证 HTTP 301 重定向
curl -I http://lovestory1314.fun

# 验证 HTTP/2 生效
curl -I --http2 -s https://lovestory1314.fun | head -n 1

# 验证 Gzip 压缩
curl -H "Accept-Encoding: gzip" -I https://lovestory1314.fun

# 验证安全响应头
curl -I https://lovestory1314.fun
```

### 5.4 生产部署脚本
执行生产部署脚本拉取最新镜像与代码：
```bash
/opt/lumino/scripts/deploy-production.sh
```
