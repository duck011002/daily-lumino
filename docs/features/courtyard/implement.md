---
id: feature/courtyard
type: implementation
status: implemented
---

# 内院与空间实施文档

## 设计要点

- 所有空间资源以当前用户和成员关系做后端鉴权。
- 私有页面、私有 API、上传和 SSE 永远不进入 ESA 或 Service Worker 共享缓存。
- 空间列表、相册列表、笔记列表使用分页或上限，避免随数据增长无限返回。
- 相册网格和照片查看器分离缩略图与原图。

## 关联源码

`frontend/src/app/courtyard/page.tsx`、`frontend/src/app/spaces/`、`backend/app/routers/spaces.py`、`backend/app/routers/albums.py`、`backend/app/routers/notes.py`。
