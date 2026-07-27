import re
from urllib.parse import parse_qs, urlparse

from sqlalchemy import select

from app.models.invite_code import InviteCode
from app.models.user import User
from app.services.auth import hash_password


def ensure_root_user(db):
    root_user = db.scalar(select(User).where(User.username == "rootuser"))
    if root_user:
        return root_user

    root_user = User(
        username="rootuser",
        email="root@example.com",
        password=hash_password("password123"),
        display_name="Root User",
        is_root=True,
        is_active=True,
    )
    db.add(root_user)
    db.commit()
    return root_user


def create_root_cookies(client, db):
    ensure_root_user(db)
    login_res = client.post(
        "/api/auth/login",
        json={"username_or_email": "rootuser", "password": "password123"},
    )
    return login_res.cookies


def create_invite_code(db, code: str, target_email: str | None = None):
    root_user = ensure_root_user(db)
    invite = InviteCode(code=code, created_by=root_user.id, target_email=target_email)
    db.add(invite)
    db.commit()
    return invite


def extract_token_from_email_body(body: str, key: str = "token") -> str:
    match = re.search(r"https?://\S+", body)
    assert match is not None
    parsed = urlparse(match.group(0))
    return parse_qs(parsed.query)[key][0]


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


def test_register_rejects_email_bound_invite_code_for_other_email(client, db):
    invite = create_invite_code(db, "bound-invite", target_email="bound@example.com")

    response = client.post(
        "/api/auth/register",
        json={
            "username": "wrongemail",
            "email": "other@example.com",
            "password": "password123",
            "invite_code": invite.code,
        },
    )
    assert response.status_code == 400
    assert "仅可用于申请时填写的邮箱" in response.json()["detail"]


def test_invite_request_submission_sends_only_verification_email(client, monkeypatch):
    sent_messages = []
    monkeypatch.setattr(
        "app.services.mail.send_email",
        lambda to_email, subject, text_body: sent_messages.append(
            {"to_email": to_email, "subject": subject, "text_body": text_body}
        ),
    )

    response = client.post(
        "/api/auth/invite-requests",
        json={
            "email": "apply@example.com",
            "display_name": "Apply User",
            "message": "please approve",
        },
    )

    assert response.status_code == 202
    assert response.json()["message"] == "如果该邮箱可以接收申请邮件，请查收并完成邮箱验证"
    assert len(sent_messages) == 1
    assert sent_messages[0]["to_email"] == "apply@example.com"
    assert "确认" in sent_messages[0]["subject"]


def test_invite_request_approval_sends_email_bound_invite_code(client, db, monkeypatch):
    ensure_root_user(db)
    sent_messages = []
    monkeypatch.setattr(
        "app.services.mail.send_email",
        lambda to_email, subject, text_body: sent_messages.append(
            {"to_email": to_email, "subject": subject, "text_body": text_body}
        ),
    )

    from app.services.invite_requests import process_pending_admin_notifications_once

    create_res = client.post(
        "/api/auth/invite-requests",
        json={
            "email": "apply@example.com",
            "display_name": "Apply User",
            "message": "please approve",
        },
    )
    assert create_res.status_code == 202
    assert len(sent_messages) == 1

    verify_token = extract_token_from_email_body(sent_messages[0]["text_body"])
    verify_res = client.get(f"/api/auth/invite-requests/verify?token={verify_token}")
    assert verify_res.status_code == 200
    assert "邮箱验证成功" in verify_res.text

    processed = process_pending_admin_notifications_once(db)
    assert processed == 1
    assert len(sent_messages) == 2
    assert sent_messages[1]["to_email"] == "root@example.com"

    approve_token = extract_token_from_email_body(sent_messages[1]["text_body"])
    approve_res = client.get(
        f"/api/auth/invite-requests/admin-action?token={approve_token}&action=approve"
    )
    assert approve_res.status_code == 200
    assert "邀请码已发送至申请邮箱" in approve_res.text

    invite_code = db.scalar(
        select(InviteCode).where(
            InviteCode.target_email == "apply@example.com", InviteCode.used_by.is_(None)
        )
    )
    assert invite_code is not None
    assert len(sent_messages) == 3
    assert sent_messages[2]["to_email"] == "apply@example.com"
    assert invite_code.code in sent_messages[2]["text_body"]


def test_admin_notification_throttle_keeps_second_request_queued(client, db, monkeypatch):
    sent_messages = []
    monkeypatch.setattr(
        "app.services.mail.send_email",
        lambda to_email, subject, text_body: sent_messages.append(
            {"to_email": to_email, "subject": subject, "text_body": text_body}
        ),
    )

    from app.services.invite_requests import process_pending_admin_notifications_once

    for email in ("first@example.com", "second@example.com"):
        create_res = client.post(
            "/api/auth/invite-requests",
            json={"email": email, "display_name": email, "message": "hello"},
        )
        assert create_res.status_code == 202

        verify_token = extract_token_from_email_body(sent_messages[-1]["text_body"])
        verify_res = client.get(f"/api/auth/invite-requests/verify?token={verify_token}")
        assert verify_res.status_code == 200

    first_processed = process_pending_admin_notifications_once(db)
    second_processed = process_pending_admin_notifications_once(db)

    assert first_processed == 1
    assert second_processed == 0
    admin_emails = [item for item in sent_messages if item["to_email"] == "root@example.com"]
    assert len(admin_emails) == 1


def test_auth_flow(client, db):
    invite = create_invite_code(db, "flow-invite")
    reg_data = {
        "username": "testuser",
        "email": "test@example.com",
        "password": "strongpassword123",
        "display_name": "Test User",
        "invite_code": invite.code,
    }
    response = client.post("/api/auth/register", json=reg_data)
    assert response.status_code == 201
    assert response.json()["username"] == "testuser"
    assert response.json()["email"] == "test@example.com"
    assert "password" not in response.json()

    response = client.post(
        "/api/auth/register",
        json={
            "username": "testuser",
            "email": "test2@example.com",
            "password": "strongpassword123",
            "invite_code": create_invite_code(db, "dup-username").code,
        },
    )
    assert response.status_code == 400
    assert "用户名已存在" in response.json()["detail"]

    response = client.post(
        "/api/auth/register",
        json={
            "username": "testuser2",
            "email": "test@example.com",
            "password": "strongpassword123",
            "invite_code": create_invite_code(db, "dup-email").code,
        },
    )
    assert response.status_code == 400
    assert "邮箱已被注册" in response.json()["detail"]

    login_data = {"username_or_email": "testuser", "password": "strongpassword123"}
    response = client.post("/api/auth/login", json=login_data)
    assert response.status_code == 200
    assert "access_token" in response.json()
    assert "access_token" in client.cookies
    assert "refresh_token" in client.cookies

    response = client.post(
        "/api/auth/login",
        json={"username_or_email": "test@example.com", "password": "strongpassword123"},
    )
    assert response.status_code == 200

    response = client.post(
        "/api/auth/login",
        json={"username_or_email": "testuser", "password": "wrongpassword"},
    )
    assert response.status_code == 401
    assert "用户名、邮箱或密码错误" in response.json()["detail"]

    response = client.get("/api/auth/me")
    assert response.status_code == 200
    assert response.json()["username"] == "testuser"

    del client.cookies["access_token"]
    response = client.get("/api/auth/me")
    assert response.status_code == 401

    response = client.post("/api/auth/refresh")
    assert response.status_code == 200
    assert "access_token" in response.json()
    assert "access_token" in client.cookies

    response = client.get("/api/auth/me")
    assert response.status_code == 200
    assert response.json()["username"] == "testuser"

    response = client.post("/api/auth/logout")
    assert response.status_code == 200

    access_token_cookie = client.cookies.get("access_token")
    refresh_token_cookie = client.cookies.get("refresh_token")
    assert access_token_cookie is None or access_token_cookie == ""
    assert refresh_token_cookie is None or refresh_token_cookie == ""

    response = client.get("/api/auth/me")
    assert response.status_code == 401
