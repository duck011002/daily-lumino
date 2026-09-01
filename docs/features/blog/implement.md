---
id: feature/blog
type: implementation
status: implemented
---

# 博客实施文档

## 设计要点

- 公开列表、精选、分类和详情与管理写入隔离。
- 列表响应只返回卡片字段，正文只在详情接口返回。
- 搜索必须提交或防抖后请求，避免每次按键触发查询。
- 发布、编辑、删除后明确失效列表、精选和详情缓存。
- 详情阅读计数不得阻塞正文读取，后续可采用增量或批量落库。

## 软删除约定

- `blog_posts.deleted_at` 为空表示有效，非空表示已经进入回收状态；常规删除接口不得调用物理 `DELETE`。
- 作者删除、管理员删除、统一行动撤销创建以及运维脚本统一写入 UTC `deleted_at`，并将 `is_featured` 设为 `false`。
- 公开列表、公共详情、浏览量写入、站点摘要、作者/管理员列表、用户文章计数和 Lumino MCP 列表必须过滤 `deleted_at IS NULL`。
- 已软删除文章的详情、预览、编辑、发布和重复删除均按不存在处理；slug 仍保持占用，避免旧 URL 被新文章意外复用。
- 迁移 `e3b7c1d9a204_add_blog_soft_delete.py` 新增字段、单列索引及 `(deleted_at, is_public, is_published)` 组合索引。
- 精确整理生产文章时使用 `scripts/soft-delete-blog-posts.py`。脚本默认 dry-run，只有显式 `--apply` 才提交；目标必须同时匹配 ID 和 slug，且有效总数必须等于预期值。

## 验收标准

- 公开文章仅在 `is_public=true` 且 `is_published=true` 时展示。
- 软删除文章不得出现在任何常规列表、详情、摘要、计数或 MCP 读取中，但数据库行必须仍然存在。
- 私有预览只允许作者或 root 用户访问。
- 管理接口、登录态和 SSE 对话不得进入公共缓存。
- 博客列表分页、搜索和详情在 API 失败时可重试。

关联源码：`frontend/src/app/blog/page.tsx`、`frontend/src/app/blog/[slug]/page.tsx`、`backend/app/routers/blog.py`。
