---
id: feature/bilingual-i18n
type: implementation
status: implemented
---

# 全站中英文切换实施文档

实现已合入 `8519dc6`。设计边界是：两种语言、浏览器本地持久化、共用 Provider、导航/主题按钮一致；动态内容翻译另立项目，不与静态 UI 翻译混合。

关联源码：`frontend/src/hooks/useLanguage.tsx`、`frontend/src/components/layout/LanguageToggle.tsx`、`frontend/src/locales/`。
