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

- The MCP endpoint requires a dedicated bearer token stored in server-only
  configuration.
- MCP tools can list sections, upload image bytes through the existing Lsky
  image-hosting integration, create a post, and publish a post.
- MCP-created posts are drafts by default. Automatic public publishing is an
  explicit server setting so a leaked token cannot silently publish content.
- The MCP author is configured with a specific user ID, which provides a clear
  authorship trail for AI-created posts.

## MCP Client Setup (After HTTPS)

- Do not configure a real MCP token while the public site is HTTP-only. A
  bearer token sent over HTTP can be intercepted.
- After the domain has working HTTPS, expose the endpoint at
  `https://<public-domain>/api/mcp/blog/` and set a long random
  `MCP_BLOG_TOKEN` plus the author account ID in the server environment.
- A compatible remote MCP client should send this header:

  ```json
  {
    "Authorization": "Bearer ${LUMINO_BLOG_TOKEN}"
  }
  ```

- The available tools are `list_blog_categories`, `upload_blog_image`,
  `create_blog_post`, and `publish_blog_post`. The image tool uses the existing
  Lsky image bed and its quota; no image-bed secret is shared with the AI.
- Keep `MCP_BLOG_ALLOW_AUTO_PUBLISH=false` for the first rollout. This lets AI
  create image-rich drafts that can be reviewed in Lumino. Enable it only when
  you intentionally want the MCP token to have public publishing authority.

## Follow-Up Checklist

- Wait for `lovestory1314.work` registrar review to finish.
- Complete ICP filing for the new domain before using it as the mainland
  production hostname.
- After DNS is live, issue origin TLS, add the new hostname to Nginx, and update
  the application public URL used in invitation emails.
- Configure the MCP bearer token and the MCP author ID only after HTTPS is live.
