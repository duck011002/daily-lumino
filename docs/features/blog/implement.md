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

## 验收标准

- 公开文章仅在 `is_public=true` 且 `is_published=true` 时展示。
- 私有预览只允许作者或 root 用户访问。
- 管理接口、登录态和 SSE 对话不得进入公共缓存。
- 博客列表分页、搜索和详情在 API 失败时可重试。

关联源码：`frontend/src/app/blog/page.tsx`、`frontend/src/app/blog/[slug]/page.tsx`、`backend/app/routers/blog.py`。
