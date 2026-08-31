---
id: feature/front-hall
type: implementation
status: implemented
---

# 前厅实施文档

## 范围

前厅负责公开个人资料、精选博客和主要入口，不包含登录后的工作台业务。

## 设计要点

- 保持公共内容可匿名访问。
- 资料与精选内容优先使用轻量聚合响应，减少首屏请求数。
- 封面、头像和文章卡片使用固定尺寸及缩略图。
- 登录态只影响导航，不阻塞公共主体渲染。
- ESA 只缓存明确的静态资源；动态 HTML/API 保持回源。

## 验收标准

- 匿名访问 `/` 可完成首屏渲染。
- 资料接口或精选接口失败时，另一块内容仍可展示。
- 首屏图片有尺寸占位，避免 CLS。
- 不向共享缓存写入 Cookie 相关响应。

## 关联源码

- `frontend/src/app/page.tsx`
- `backend/app/routers/site.py`
- `backend/app/routers/blog.py`
