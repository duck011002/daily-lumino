---
id: feature/bilingual-i18n
type: current
status: implemented
last_inspected_at: 2026-08-28
last_verified_at: null
source_commit: 8519dc653b8c12d21a9920bc1fb35a427a6620cd
---

# 全站中英文切换当前状态

- 根布局使用 `LanguageProvider`，语言偏好保存在浏览器本地。
- `LanguageToggle` 与主题切换按钮并列放置。
- 静态界面文案已集中到 `frontend/src/locales/zh.ts`、`en.ts`。
- 当前实现覆盖界面文案；博客、站点资料、书房收藏等动态内容自动翻译尚未纳入已验证范围。
- 类型检查和 Lint 已在本地通过，生产线上完整验收记录待补。
