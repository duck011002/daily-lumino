---
id: feature/auth-invite
type: implementation
status: implemented
---

# 认证与邀请申请实施文档

- 不在仓库记录账号密码、Token 或邮件密钥。
- 认证失败、过期、禁用和权限不足返回可读且不泄露敏感信息的错误。
- 邮箱验证与管理员动作链接必须验证状态和过期时间。
- 认证相关响应禁止公共缓存，Axios 401 刷新逻辑不得形成无限重试。
