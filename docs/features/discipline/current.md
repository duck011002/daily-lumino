---
id: feature/discipline
type: current
status: implemented
last_inspected_at: 2026-08-28
last_verified_at: null
---

# 健康与自律当前状态

- 路由：`/discipline`
- 数据属于登录用户的私有健康记录。
- 包含健康档案、每日记录、饮食/健身图片和 AI 分析。
- 入口和 API 必须绕过 ESA 缓存；图片应区分缩略图与原图。
- 详细业务设计仍以 `frontend/src/app/discipline/page.tsx` 与 `backend/app/routers/discipline.py` 为准。
