# Lumino 邀请码申请流方案规划 (待办事项 / TODO)

本项目计划在未来引入完整的“邀请码申请与审核流 (Invite Request Flow)”。以下为详细规划方案及开发规程：

---

## 1. 核心业务流程与功能设计

- **注册强制要求邀请码**：注册时必须填写邀请码，且支持绑定邮箱限制（防止邀请码被冒用）。
- **邀请码申请页面**：新增 `/invite-request` 申请页面，供未获邀用户登记邮箱、昵称与申请理由。
- **双向验证流**：
  1. 申请人提交邮箱后，系统生成带验证 Token 的确认邮件，申请人需点击链接激活验证邮箱。
  2. 激活后，系统在后台对管理员进行流控通知（使用 Redis 分布式锁与令牌桶/计数器限制管理员接收通知的频率）。
  3. 管理员收到邮件，点击内置的一次性链接直接同意（Approve）或拒绝（Reject）申请。
  4. 同意申请后，系统自动生成绑定该申请人邮箱的邀请码，并通过邮件发送给申请人。

---

## 2. 后端数据持久化设计 (Models & Alembic)

### InviteCode 扩展字段
- 新增 `target_email` (VARCHAR(100), nullable=True) 索引列，用于绑定特定受邀者。

### InviteRequest 模型设计
```python
class InviteRequest(Base):
    __tablename__ = "invite_requests"
    
    id: Mapped[int] = mapped_column(BIGINT_PK, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(32), index=True, nullable=False, default="pending_verify")
    display_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    message: Mapped[str | None] = mapped_column(String(500), nullable=True)
    request_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)
    
    verify_token_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    admin_action_token_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    invite_code_id: Mapped[int | None] = mapped_column(BIGINT_FK, ForeignKey("invite_codes.id"), nullable=True)
    
    verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    admin_notified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
```

---

## 3. 开发规程与避坑要点 (Review Highlights)

### A. Next.js 静态编译的 Suspense 限制
- **警告**：在 Next.js (App Router) 页面（如 `/register`）中如果直接使用 `useSearchParams()` 获取查询参数，**必须将其包裹在 `<Suspense>` 边界内**。
- **原因**：否则在运行 `npm run build` 时，Next.js 会因静态化报错而中断打包。

### B. Background Worker 的数据库会话隔离
- **警告**：后台轮询通知与流控逻辑（如 `process_pending_admin_notifications_once`）不在 FastAPI Request 生命周期内。
- **原因**：**绝不能直接使用全局 `db` 实例或共享的 session 依赖**。必须采用 `with SessionLocal() as db:` 上下文管理器来按需创建、提交和及时关闭会话，避免连接泄漏。

### C. 锁定与流控机制
- **技术实现**：建议基于 Redis 的 `SET NX` 实现临时排他锁（防止多个后台进程同时发送重复的申请邮件），并利用 Redis 的 `INCR/EXPIRE` 限制管理员每小时接收申请通知的最大频次。
