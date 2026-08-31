---
id: feature/library
type: implementation
status: implemented
---

# 书房实施文档

## 设计要点

- 公开头部与收藏卡片分离字段投影。
- 默认只加载首屏所需卡片；分类切换使用客户端缓存和局部刷新。
- 列表使用 `card/thumb` 图片，查看器或外链跳转才使用原图。
- 私有编辑接口与公共读取接口分离，禁止缓存用户相关响应。

## 验收标准

- 分类切换不触发整页白屏。
- 空列表、接口失败和图片失败均有可读回退。
- 公开 API 不返回后台编辑字段或私有内容。

关联源码：`frontend/src/app/library/page.tsx`、`backend/app/routers/site.py`。
