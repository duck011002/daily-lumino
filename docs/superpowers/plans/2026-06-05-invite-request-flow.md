# Invite Request Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make registration require invite codes, add a styled invite-request page with email verification, and let approved requests generate email-bound invite codes with admin-email throttling.

**Architecture:** Keep the existing `/api/auth/*` registration flow and `invite_codes` table, then layer a focused `invite_requests` workflow on top. Use a small mail service plus a lightweight notification worker so verified requests can queue for admin-email delivery without blocking the request path.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, Redis, smtplib/email.message, Next.js App Router, React state hooks, pytest

---

## File Map

- Modify: `backend/app/config.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/models/invite_code.py`
- Create: `backend/app/models/invite_request.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/app/schemas/auth.py`
- Modify: `backend/app/schemas/user.py`
- Modify: `backend/app/schemas/__init__.py`
- Create: `backend/app/services/mail.py`
- Create: `backend/app/services/invite_requests.py`
- Modify: `backend/app/routers/auth.py`
- Create: `backend/alembic/versions/0b2f7ef29c7c_add_invite_request_flow.py`
- Modify: `backend/tests/conftest.py`
- Modify: `backend/tests/test_auth.py`
- Create: `frontend/src/app/invite-request/page.tsx`
- Modify: `frontend/src/app/register/page.tsx`
- Modify: `frontend/src/hooks/useAuth.tsx`
- Modify: `frontend/src/lib/api.ts`

### Task 1: Backend Persistence and Registration Guard

**Files:**
- Modify: `backend/tests/test_auth.py`
- Modify: `backend/app/schemas/user.py`
- Modify: `backend/app/models/invite_code.py`
- Create: `backend/app/models/invite_request.py`
- Modify: `backend/app/models/__init__.py`
- Create: `backend/alembic/versions/0b2f7ef29c7c_add_invite_request_flow.py`

- [ ] **Step 1: Write failing backend tests for required invite codes and email-bound codes**

```python
def test_register_requires_invite_code(client):
    response = client.post(
        "/api/auth/register",
        json={
            "username": "nocode",
            "email": "nocode@example.com",
            "password": "password123",
        },
    )
    assert response.status_code == 422


def test_register_rejects_email_bound_invite_code_for_other_email(client, admin_test_setup, db):
    create_res = client.post(
        "/api/admin/invite-codes",
        json={"expires_in_hours": 24},
        cookies=admin_test_setup["admin"],
    )
    code = create_res.json()["code"]
    invite = db.scalar(select(InviteCode).where(InviteCode.code == code))
    invite.target_email = "bound@example.com"
    db.commit()

    response = client.post(
        "/api/auth/register",
        json={
            "username": "wrongemail",
            "email": "other@example.com",
            "password": "password123",
            "invite_code": code,
        },
    )
    assert response.status_code == 400
    assert "仅可用于申请时填写的邮箱" in response.json()["detail"]
```

- [ ] **Step 2: Run the targeted auth tests and verify they fail for the right reason**

Run: `cd backend; pytest tests/test_auth.py -k "invite_code or auth_flow" -v`

Expected: FAIL because registration still accepts missing invite codes and invite codes have no email-binding field.

- [ ] **Step 3: Update persistence and schema definitions**

```python
class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=255)
    invite_code: str = Field(..., min_length=1, max_length=64)


class InviteCode(Base):
    target_email: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)


class InviteRequest(Base):
    __tablename__ = "invite_requests"
    id: Mapped[int] = mapped_column(BIGINT_PK, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    verify_token_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    admin_action_token_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
```

- [ ] **Step 4: Add the Alembic migration for `invite_requests` and `invite_codes.target_email`**

```python
def upgrade():
    op.add_column("invite_codes", sa.Column("target_email", sa.String(length=100), nullable=True))
    op.create_index(op.f("ix_invite_codes_target_email"), "invite_codes", ["target_email"], unique=False)
    op.create_table(
        "invite_requests",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("email", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("verify_token_hash", sa.String(length=128), nullable=True),
        sa.Column("admin_action_token_hash", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
```

- [ ] **Step 5: Re-run the focused auth tests**

Run: `cd backend; pytest tests/test_auth.py -k "invite_code or auth_flow" -v`

Expected: still FAIL, but now on registration logic rather than missing schema/model fields.

- [ ] **Step 6: Commit the persistence changes**

```bash
git add backend/app/schemas/user.py backend/app/models/invite_code.py backend/app/models/invite_request.py backend/app/models/__init__.py backend/alembic/versions/0b2f7ef29c7c_add_invite_request_flow.py backend/tests/test_auth.py
git commit -m "feat: add invite request persistence"
```

### Task 2: Invite Request Workflow, Mail Service, and Admin Notification Throttling

**Files:**
- Modify: `backend/tests/conftest.py`
- Modify: `backend/tests/test_auth.py`
- Modify: `backend/app/config.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/schemas/auth.py`
- Modify: `backend/app/schemas/__init__.py`
- Create: `backend/app/services/mail.py`
- Create: `backend/app/services/invite_requests.py`
- Modify: `backend/app/routers/auth.py`

- [ ] **Step 1: Write failing tests for invite-request submit, verify, approve, reject, and throttled admin delivery**

```python
def test_invite_request_verification_required_before_admin_email(client, monkeypatch):
    sent_messages = []
    monkeypatch.setattr("app.services.mail.send_email", lambda **kwargs: sent_messages.append(kwargs))

    response = client.post(
        "/api/auth/invite-requests",
        json={"email": "apply@example.com", "display_name": "Apply User", "message": "please"},
    )

    assert response.status_code == 202
    assert len(sent_messages) == 1
    assert "确认" in sent_messages[0]["subject"]


def test_verifying_request_enqueues_admin_notification_and_approval_sends_bound_invite_code(client, db, monkeypatch):
    sent_messages = []
    monkeypatch.setattr("app.services.mail.send_email", lambda **kwargs: sent_messages.append(kwargs))
    create_res = client.post(
        "/api/auth/invite-requests",
        json={"email": "apply@example.com", "display_name": "Apply User", "message": "please"},
    )
    assert create_res.status_code == 202

    request_id = create_res.json()["request_id"]
    invite_request = db.get(InviteRequest, request_id)
    verify_res = client.get(f"/api/auth/invite-requests/verify?token={invite_request._plain_verify_token}")
    assert verify_res.status_code == 200

    processed = process_pending_admin_notifications_once()
    assert processed == 1
    assert any("新的邀请码申请待处理" in item["subject"] for item in sent_messages)

    approve_res = client.get(f"/api/auth/invite-requests/admin-action?token={invite_request._plain_admin_token}&action=approve")
    assert approve_res.status_code == 200

    db.refresh(invite_request)
    invite_code = db.get(InviteCode, invite_request.invite_code_id)
    assert invite_code.target_email == "apply@example.com"
```

- [ ] **Step 2: Run the invite-request tests and verify RED**

Run: `cd backend; pytest tests/test_auth.py -k "invite_request" -v`

Expected: FAIL because the new routes, services, and mail infrastructure do not exist yet.

- [ ] **Step 3: Add config and mail service primitives**

```python
class Settings(BaseSettings):
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    INVITE_REQUEST_ADMIN_EMAIL: str = ""
    INVITE_REQUEST_VERIFY_EXPIRE_MINUTES: int = 30
    INVITE_REQUEST_ADMIN_ACTION_EXPIRE_HOURS: int = 24
    INVITE_CODE_REQUEST_EXPIRE_HOURS: int = 48
    INVITE_REQUEST_WORKER_ENABLED: bool = True
```

```python
def send_email(to_email: str, subject: str, text_body: str) -> None:
    if not settings.smtp_host or not settings.smtp_from_email:
        raise RuntimeError("SMTP is not configured")
    message = EmailMessage()
    message["From"] = settings.smtp_from_email
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(text_body)
```

- [ ] **Step 4: Implement invite-request service helpers and routes**

```python
@router.post("/invite-requests", status_code=status.HTTP_202_ACCEPTED)
def create_invite_request(payload: InviteRequestCreate, request: Request, db: Session = Depends(get_db)):
    return submit_invite_request(
        db=db,
        email=payload.email,
        display_name=payload.display_name,
        message=payload.message,
        request_ip=request.client.host if request.client else "",
        user_agent=request.headers.get("user-agent", ""),
    )


@router.get("/invite-requests/verify", response_class=HTMLResponse)
def verify_invite_request_route(token: str, db: Session = Depends(get_db)):
    return verify_invite_request(db, token)
```

- [ ] **Step 5: Add the notification worker and throttled queue processor**

```python
def process_pending_admin_notifications_once() -> int:
    if not acquire_notification_lock():
        return 0
    request = db.scalar(
        select(InviteRequest)
        .where(InviteRequest.status == "pending_admin_review", InviteRequest.admin_notified_at.is_(None))
        .order_by(InviteRequest.verified_at.asc(), InviteRequest.id.asc())
    )
    if request is None or not admin_notification_slot_available():
        return 0
    send_admin_review_email(request)
    request.admin_notified_at = datetime.now(UTC).replace(tzinfo=None)
```

- [ ] **Step 6: Re-run invite-request tests until GREEN**

Run: `cd backend; pytest tests/test_auth.py -k "invite_request" -v`

Expected: PASS for submit, verify, approve, reject, and throttled admin notification behavior.

- [ ] **Step 7: Commit the workflow changes**

```bash
git add backend/tests/conftest.py backend/tests/test_auth.py backend/app/config.py backend/app/main.py backend/app/schemas/auth.py backend/app/schemas/__init__.py backend/app/services/mail.py backend/app/services/invite_requests.py backend/app/routers/auth.py
git commit -m "feat: add invite request workflow"
```

### Task 3: Frontend Registration UX and Invite Request Page

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/hooks/useAuth.tsx`
- Modify: `frontend/src/app/register/page.tsx`
- Create: `frontend/src/app/invite-request/page.tsx`

- [ ] **Step 1: Update error extraction coverage before touching the pages**

```typescript
export function getErrorMessage(err: any, defaultMsg = '操作失败，请重试。'): string {
  const detail = err.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg || '格式错误').join('; ')
  }
  if (detail && typeof detail === 'object') {
    return detail.message || defaultMsg
  }
  return err.message || defaultMsg
}
```

- [ ] **Step 2: Wire register-page query params and required invite-code validation**

```tsx
const searchParams = useSearchParams()
const presetEmail = searchParams.get('email') || ''
const presetInviteCode = searchParams.get('invite_code') || ''

if (!inviteCode.trim()) {
  setErrorMsg('请输入邀请码')
  return
}
```

- [ ] **Step 3: Add the invite-request page matching the current auth-page style**

```tsx
export default function InviteRequestPage() {
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [message, setMessage] = useState('')
  const [feedback, setFeedback] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await api.post('/auth/invite-requests', {
      email: email.trim(),
      display_name: displayName.trim() || null,
      message: message.trim() || null,
    })
    setFeedback('如果该邮箱可以接收申请邮件，请查收并完成邮箱验证')
  }
}
```

- [ ] **Step 4: Run frontend checks**

Run: `cd frontend; npm run lint`

Expected: PASS with no new lint errors in `register/page.tsx`, `invite-request/page.tsx`, `useAuth.tsx`, or `api.ts`.

- [ ] **Step 5: Commit the frontend changes**

```bash
git add frontend/src/lib/api.ts frontend/src/hooks/useAuth.tsx frontend/src/app/register/page.tsx frontend/src/app/invite-request/page.tsx
git commit -m "feat: update invite-only registration ui"
```

### Task 4: End-to-End Verification and Cleanup

**Files:**
- Modify if needed: any file touched above
- Review: `docs/superpowers/specs/2026-06-05-invite-request-design.md`

- [ ] **Step 1: Run the backend auth suite**

Run: `cd backend; pytest tests/test_auth.py -v`

Expected: PASS

- [ ] **Step 2: Run the broader backend regression slice around admin invite codes**

Run: `cd backend; pytest tests/test_admin.py -k "invite" -v`

Expected: PASS

- [ ] **Step 3: Run frontend lint**

Run: `cd frontend; npm run lint`

Expected: PASS

- [ ] **Step 4: Review diffs for accidental scope creep**

Run: `git diff --stat HEAD~3..HEAD`

Expected: only invite-request flow, registration validation, mail/config support, and related tests.

- [ ] **Step 5: Prepare branch-finishing handoff**

```bash
git status --short
git log --oneline -3
```

Expected: clean working tree with the invite-request commits visible and ready for final review.
