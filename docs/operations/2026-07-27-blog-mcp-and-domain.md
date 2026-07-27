# 2026-07-27 Blog, MCP, And Domain Operations

## Purpose

Track the public technical blog redesign, delegated blog-author permissions,
AI/MCP publishing capabilities, and the domain migration work. Secrets are
intentionally excluded from this document.

## Current Deployment Baseline

- Repository sync branch: `codex/sync-server-20260727`.
- Deployed application commit: `4ba2a67`.
- Backend and frontend run under PM2 on the production server.
- Database migration before this work: `0b2f7ef29c7c`.
- Invite request mail delivery uses the configured SMTP mailbox. Credentials are
  stored only in the server environment file.

## 2026-07-27 Deployment Result

- Production was upgraded to commit `425e03a`.
- Alembic migration `d91b7b43ce11` completed successfully; it only adds the
  blog-category table and permission/category fields.
- Backend health, public blog page, and the new public categories endpoint
  returned successful responses after restart.
- The category list is intentionally empty until a root user creates the first
  sections in the admin console.
- The MCP endpoint returned `401` without a token, which confirms it is not
  publicly usable before explicit server configuration.

## HTTPS Enablement For The Existing Domain

- The existing `lovestory1314.fun` domain is the active public hostname while
  the new `.work` domain finishes DNS propagation and subsequent setup.
- A Let's Encrypt certificate for `lovestory1314.fun` was issued on 2026-07-27
  and is valid through 2026-10-25.
- Nginx now redirects HTTP to HTTPS and serves the application and `/api/*`
  over TLS. Public health and blog checks passed after the configuration change.
- Application settings now use `https://lovestory1314.fun` for generated public
  links and secure cookies. Existing browser sessions may need to log in again.
- Certbot uses the Nginx authenticator for renewal. A daily cron task runs
  `certbot renew` and reloads Nginx; a dry-run renewal succeeded without taking
  the site offline.
- The MCP endpoint is now transport-safe at
  `https://lovestory1314.fun/api/mcp/blog/`, but remains disabled until a
  dedicated bearer token and author ID are intentionally configured.

## Cloudflare And Domain Status

- Existing public domain: `lovestory1314.fun`.
- Its registrar record currently shows an expiry date of 2027-10-24.
- New domain: `lovestory1314.work`.
- The new domain was added to Cloudflare with these authoritative nameservers:
  `mina.ns.cloudflare.com` and `sam.ns.cloudflare.com`.
- The registrar change was submitted, but the domain was still marked
  "注册局审核中" at the time of this record. No production hostname, TLS, or
  application URL switch should be performed until the registrar marks it
  normal and public DNS resolves to the production server.
- Cloudflare is now the authoritative DNS provider for the new `.work` zone.
  It becomes a reverse proxy only after the site A/CNAME records are orange
  clouded. It centralizes DNS, edge TLS, caching, and basic DDoS protections;
  it does not replace China mainland ICP filing requirements. The existing
  `.fun` site is not automatically moved or protected by this new zone.

## Blog Redesign Decisions

- The public blog is a technical portfolio, not a lifestyle journal.
- Public content is grouped into explicit sections such as `Agent / Skill`,
  `Deep Learning`, `AI & LLM`, `Engineering`, and `Lumino Development Log`.
- Root users can manage all posts and sections.
- Users with the `can_write_blog` permission can create and manage only their
  own posts.
- Public readers can see only posts that are both public and published.
- The public page will emphasize featured work, sections, article metadata, and
  clear reader navigation.

## MCP Publishing Safety

- The MCP endpoint requires a dedicated bearer token issued only by a root
  user in the Lumino admin console. The raw token is shown once at creation;
  the database stores only its SHA-256 hash.
- Each credential has its own label, bound blog author, active/inactive switch,
  automatic-publishing permission, creation time, and last-used timestamp.
- Revoking a credential takes effect on the next MCP request, without changing
  server environment variables or restarting the application.
- MCP tools can list sections, upload image bytes through the existing Lsky
  image-hosting integration, create a post, and publish a post.
- MCP-created posts are drafts by default. Automatic public publishing is an
  explicit per-credential permission so a leaked token cannot silently publish
  content unless that capability was deliberately granted.
- The credential author provides a clear authorship trail for AI-created posts.

## MCP Client Setup (After HTTPS)

- Do not configure a real MCP token while the public site is HTTP-only. A
  bearer token sent over HTTP can be intercepted.
- After the domain has working HTTPS, create a credential in `超级管理员后台 ->
  AI 发布 MCP`, copy its one-time token into the local environment variable
  `LUMINO_BLOG_MCP_TOKEN`, and connect the client to
  `https://<public-domain>/api/mcp/blog/`.
- Codex can register the remote server with:

  ```bash
  codex mcp add lumino-blog --url https://<public-domain>/api/mcp/blog/ --bearer-token-env-var LUMINO_BLOG_MCP_TOKEN
  ```

- The available tools are `list_blog_categories`, `upload_blog_image`,
  `create_blog_post`, and `publish_blog_post`. The image tool uses the existing
  Lsky image bed and its quota; no image-bed secret is shared with the AI.
- Keep automatic publishing disabled for the first rollout. This lets AI create
  image-rich drafts that can be reviewed in Lumino. Enable it only for a
  specific credential when you intentionally want that AI client to have public
  publishing authority.

## Follow-Up Checklist

- Wait for `lovestory1314.work` registrar review to finish.
- Complete ICP filing for the new domain before using it as the mainland
  production hostname.
- After DNS is live, issue origin TLS, add the new hostname to Nginx, and update
  the application public URL used in invitation emails.
- Create the first MCP credential in the root admin console after this feature
  is deployed, then configure the intended AI client with its one-time token.
