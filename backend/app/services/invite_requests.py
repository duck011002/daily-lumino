import secrets
import threading
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from urllib.parse import urlencode

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models.invite_code import InviteCode
from app.models.invite_request import InviteRequest
from app.models.user import User
from app.services import mail

_worker_stop_event = threading.Event()
_worker_thread: threading.Thread | None = None


def utcnow_naive() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def hash_token(token: str) -> str:
    return sha256(token.encode("utf-8")).hexdigest()


def build_public_url(path: str, **query: str) -> str:
    base = settings.FRONTEND_BASE_URL.rstrip("/")
    encoded = urlencode(query)
    if encoded:
        return f"{base}{path}?{encoded}"
    return f"{base}{path}"


def get_admin_email() -> str:
    return settings.INVITE_REQUEST_ADMIN_EMAIL or settings.ROOT_EMAIL


def render_verification_email(token: str) -> tuple[str, str]:
    subject = "请确认你的邀请码申请邮箱"
    verify_url = build_public_url("/api/auth/invite-requests/verify", token=token)
    body = (
        "你正在申请 Lumino 邀请码。\n\n"
        "请点击下方链接确认这是你的邮箱：\n"
        f"{verify_url}\n\n"
        f"链接将在 {settings.INVITE_REQUEST_VERIFY_EXPIRE_MINUTES} 分钟后失效。"
    )
    return subject, body


def render_admin_review_email(invite_request: InviteRequest, token: str) -> tuple[str, str]:
    approve_url = build_public_url(
        "/api/auth/invite-requests/admin-action", token=token, action="approve"
    )
    reject_url = build_public_url(
        "/api/auth/invite-requests/admin-action", token=token, action="reject"
    )
    subject = "新的邀请码申请待处理"
    body = (
        "有一个新的 Lumino 邀请码申请等待处理。\n\n"
        f"申请邮箱：{invite_request.email}\n"
        f"称呼：{invite_request.display_name or '未填写'}\n"
        f"申请说明：{invite_request.message or '未填写'}\n"
        f"申请时间：{invite_request.created_at}\n"
        f"验证时间：{invite_request.verified_at}\n"
        f"来源 IP：{invite_request.request_ip or '未知'}\n\n"
        "批准并发送邀请码：\n"
        f"{approve_url}\n\n"
        "拒绝申请：\n"
        f"{reject_url}"
    )
    return subject, body


def render_invite_code_email(email: str, invite_code: InviteCode) -> tuple[str, str]:
    subject = "你的 Lumino 邀请码已批准"
    register_url = build_public_url(
        "/register", email=email, invite_code=invite_code.code
    )
    expires_at = invite_code.expires_at.isoformat(sep=" ") if invite_code.expires_at else "未设置"
    body = (
        "你的 Lumino 邀请码申请已通过。\n\n"
        f"邀请码：{invite_code.code}\n"
        f"有效期至：{expires_at}\n"
        f"注册链接：{register_url}\n\n"
        "该邀请码仅可用于当前申请邮箱，且只能使用一次。"
    )
    return subject, body


def submit_invite_request(
    db: Session,
    email: str,
    display_name: str | None,
    message: str | None,
    request_ip: str | None,
    user_agent: str | None,
) -> InviteRequest:
    token = secrets.token_urlsafe(32)
    now = utcnow_naive()
    invite_request = InviteRequest(
        email=email,
        display_name=display_name,
        message=message,
        status="pending_verify",
        verify_token_hash=hash_token(token),
        verify_token_expires_at=now + timedelta(minutes=settings.INVITE_REQUEST_VERIFY_EXPIRE_MINUTES),
        request_ip=request_ip,
        user_agent=user_agent,
    )
    db.add(invite_request)
    db.commit()
    db.refresh(invite_request)

    subject, body = render_verification_email(token)
    mail.send_email(email, subject, body)
    return invite_request


def verify_invite_request(db: Session, token: str) -> tuple[int, str]:
    now = utcnow_naive()
    invite_request = db.scalar(
        select(InviteRequest).where(InviteRequest.verify_token_hash == hash_token(token))
    )
    if not invite_request:
        return 400, "验证链接已失效，请重新申请"

    if invite_request.status != "pending_verify":
        return 400, "验证链接已失效，请重新申请"

    if (
        invite_request.verify_token_expires_at
        and invite_request.verify_token_expires_at < now
    ):
        invite_request.status = "expired"
        db.commit()
        return 400, "验证链接已失效，请重新申请"

    invite_request.status = "pending_admin_review"
    invite_request.verified_at = now
    invite_request.verify_token_hash = None
    invite_request.verify_token_expires_at = None
    invite_request.admin_action_token_hash = hash_token(secrets.token_urlsafe(32))
    invite_request.admin_action_expires_at = now + timedelta(
        hours=settings.INVITE_REQUEST_ADMIN_ACTION_EXPIRE_HOURS
    )
    db.commit()
    return 200, "邮箱验证成功，申请已进入管理员审核队列"


def can_send_admin_notification(db: Session) -> bool:
    latest_notified_at = db.scalar(select(func.max(InviteRequest.admin_notified_at)))
    if latest_notified_at is None:
        return True
    elapsed = utcnow_naive() - latest_notified_at
    return elapsed.total_seconds() >= settings.INVITE_REQUEST_ADMIN_INTERVAL_SECONDS


def process_pending_admin_notifications_once(db: Session | None = None) -> int:
    owns_session = db is None
    session = db or SessionLocal()
    try:
        admin_email = get_admin_email()
        if not admin_email or not can_send_admin_notification(session):
            return 0

        invite_request = session.scalar(
            select(InviteRequest)
            .where(
                InviteRequest.status == "pending_admin_review",
                InviteRequest.admin_notified_at.is_(None),
            )
            .order_by(InviteRequest.verified_at.asc(), InviteRequest.id.asc())
        )
        if not invite_request or not invite_request.admin_action_token_hash:
            return 0

        token = secrets.token_urlsafe(32)
        invite_request.admin_action_token_hash = hash_token(token)
        invite_request.admin_action_expires_at = utcnow_naive() + timedelta(
            hours=settings.INVITE_REQUEST_ADMIN_ACTION_EXPIRE_HOURS
        )

        subject, body = render_admin_review_email(invite_request, token)
        mail.send_email(admin_email, subject, body)

        invite_request.admin_notified_at = utcnow_naive()
        session.commit()
        return 1
    finally:
        if owns_session:
            session.close()


def _get_root_user(db: Session) -> User:
    root_user = db.scalar(select(User).where(User.is_root.is_(True)).order_by(User.id.asc()))
    if not root_user:
        raise RuntimeError("No root user available to issue invite codes")
    return root_user


def approve_invite_request(db: Session, invite_request: InviteRequest) -> None:
    now = utcnow_naive()
    root_user = _get_root_user(db)
    invite_code = InviteCode(
        code=secrets.token_hex(16),
        target_email=invite_request.email,
        created_by=root_user.id,
        expires_at=now + timedelta(hours=settings.INVITE_REQUEST_CODE_EXPIRE_HOURS),
    )
    db.add(invite_code)
    db.flush()

    invite_request.status = "approved"
    invite_request.approved_at = now
    invite_request.invite_code_id = invite_code.id
    invite_request.admin_action_token_hash = None
    invite_request.admin_action_expires_at = None
    db.commit()
    db.refresh(invite_code)

    subject, body = render_invite_code_email(invite_request.email, invite_code)
    mail.send_email(invite_request.email, subject, body)


def reject_invite_request(db: Session, invite_request: InviteRequest) -> None:
    invite_request.status = "rejected"
    invite_request.rejected_at = utcnow_naive()
    invite_request.admin_action_token_hash = None
    invite_request.admin_action_expires_at = None
    db.commit()


def handle_admin_action(db: Session, token: str, action: str) -> tuple[int, str]:
    now = utcnow_naive()
    invite_request = db.scalar(
        select(InviteRequest).where(InviteRequest.admin_action_token_hash == hash_token(token))
    )
    if not invite_request or invite_request.status != "pending_admin_review":
        return 400, "审批链接已失效，请重新处理待审申请"

    if (
        invite_request.admin_action_expires_at
        and invite_request.admin_action_expires_at < now
    ):
        invite_request.status = "expired"
        db.commit()
        return 400, "审批链接已失效，请重新处理待审申请"

    if action == "approve":
        approve_invite_request(db, invite_request)
        return 200, "邀请码已发送至申请邮箱"

    if action == "reject":
        reject_invite_request(db, invite_request)
        return 200, "申请已拒绝"

    return 400, "审批动作无效"


def _worker_loop():
    while not _worker_stop_event.wait(5):
        try:
            process_pending_admin_notifications_once()
        except Exception:
            continue


def start_invite_request_worker():
    global _worker_thread
    if not settings.INVITE_REQUEST_WORKER_ENABLED:
        return
    if _worker_thread and _worker_thread.is_alive():
        return

    _worker_stop_event.clear()
    _worker_thread = threading.Thread(
        target=_worker_loop,
        name="invite-request-worker",
        daemon=True,
    )
    _worker_thread.start()


def stop_invite_request_worker():
    global _worker_thread
    _worker_stop_event.set()
    if _worker_thread and _worker_thread.is_alive():
        _worker_thread.join(timeout=1)
    _worker_thread = None
