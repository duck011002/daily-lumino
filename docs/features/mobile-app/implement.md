---
id: feature/mobile-app
type: implementation
status: implemented
last_reviewed_at: 2026-08-28
---

# Android 移动端实施文档

当前完整设计稿位于 `docs/mobile-app-design.md`，属于早期设计参考。源码已存在；后续实施工作应把已确认内容收敛到本文，并至少明确：

- 首版页面、导航和公开/私密功能边界；
- 是否需要新增后端接口、数据表或上传能力；
- 登录态、Token 存储、退出登录和多用户隔离；
- 与现有 Web API 的兼容策略；
- HBuilderX、Android SDK、环境变量和签名配置的本地构建方法；
- 单元测试、接口回归、模拟器/真机验收与发布回滚方式。

在用户确认前，不根据旧设计稿自动扩展服务端范围；已有移动端源码的发布资格仍需按 `walkthrough.md` 补齐证据。
