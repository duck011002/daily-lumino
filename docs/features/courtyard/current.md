---
id: feature/courtyard
type: current
status: implemented
last_inspected_at: 2026-08-28
last_verified_at: null
---

# 内院与空间当前状态

- 路由：`/courtyard`、`/dashboard`、`/spaces`、`/spaces/[id]`
- 未登录用户从内院门廊进入登录；已登录用户重定向到工作台。
- 空间、成员、邀请码、相册和笔记属于鉴权数据，必须保持 `private, no-store`。
- 相册照片接口当前一次返回相册全部照片；列表应优先使用 `thumb_url`，原图在查看器按需获取。
- ESA 规则已将内院、空间、聊天和健康记录列入动态绕过范围。
