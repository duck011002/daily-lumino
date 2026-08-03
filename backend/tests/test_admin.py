from datetime import datetime, timedelta, UTC
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.models.user import User
from app.models.invite_code import InviteCode
from app.models.mcp_blog_token import MCPBlogToken
from app.models.mcp_library_token import MCPLibraryToken
from app.models.system_config import SystemConfig
from app.models.storage_quota import StorageQuota
from app.mcp_blog import resolve_mcp_blog_identity
from app.mcp_library import resolve_mcp_library_identity
from app.services.auth import hash_password
from app.utils.crypto import decrypt_value


@pytest.fixture
def admin_test_setup(client: TestClient, db):
    normal_user = User(
        username="normaluser",
        email="normal@example.com",
        password=hash_password("password123"),
        display_name="Normal User",
        is_active=True,
    )
    admin_user = User(
        username="adminuser",
        email="admin@example.com",
        password=hash_password("password123"),
        display_name="Admin User",
        is_root=True,
        is_active=True,
    )
    db.add(normal_user)
    db.add(admin_user)
    db.commit()

    res_normal = client.post("/api/auth/login", json={"username_or_email": "normaluser", "password": "password123"})
    normal_cookies = res_normal.cookies

    res_admin = client.post("/api/auth/login", json={"username_or_email": "adminuser", "password": "password123"})
    admin_cookies = res_admin.cookies

    return {
        "normal": normal_cookies,
        "admin": admin_cookies
    }


def test_user_status_management(client: TestClient, admin_test_setup, db):
    admin_cookies = admin_test_setup["admin"]
    normal_cookies = admin_test_setup["normal"]

    # 1. Admin lists all users
    list_res = client.get("/api/admin/users", cookies=admin_cookies)
    assert list_res.status_code == 200
    usernames = [u["username"] for u in list_res.json()]
    assert "normaluser" in usernames
    assert "adminuser" in usernames

    # Retrieve normal user database ID
    normal_id = db.scalar(select(User.id).where(User.username == "normaluser"))

    # 2. Disable normaluser
    patch_res = client.patch(
        f"/api/admin/users/{normal_id}",
        json={"is_active": False},
        cookies=admin_cookies,
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["is_active"] is False

    # 3. Test that normaluser cannot access protected endpoint anymore (returns 401)
    me_res = client.get("/api/auth/me", cookies=normal_cookies)
    assert me_res.status_code == 401

    # 4. Test that normaluser login fails
    login_res = client.post("/api/auth/login", json={"username_or_email": "normaluser", "password": "password123"})
    assert login_res.status_code == 401
    assert "detail" in login_res.json()

    # 5. Re-enable normaluser
    patch_res2 = client.patch(
        f"/api/admin/users/{normal_id}",
        json={"is_active": True},
        cookies=admin_cookies,
    )
    assert patch_res2.status_code == 200
    assert patch_res2.json()["is_active"] is True

    # 6. Can log in again
    login_res2 = client.post("/api/auth/login", json={"username_or_email": "normaluser", "password": "password123"})
    assert login_res2.status_code == 200


def test_invite_code_management(client: TestClient, admin_test_setup, db):
    admin_cookies = admin_test_setup["admin"]

    # 1. Create a global invite code
    create_res = client.post(
        "/api/admin/invite-codes",
        json={"expires_in_hours": 24},
        cookies=admin_cookies,
    )
    assert create_res.status_code == 201
    code = create_res.json()["code"]
    assert len(code) == 32

    # 2. List invite codes
    list_res = client.get("/api/admin/invite-codes", cookies=admin_cookies)
    assert list_res.status_code == 200
    codes = [c["code"] for c in list_res.json()]
    assert code in codes

    # 3. Register user using invite code
    reg_res = client.post(
        "/api/auth/register",
        json={
            "username": "inviteduser",
            "email": "invited@example.com",
            "password": "password123",
            "invite_code": code
        }
    )
    assert reg_res.status_code == 201
    assert reg_res.json()["username"] == "inviteduser"

    # 4. Try to register another user with the SAME invite code -> fails
    reg_res2 = client.post(
        "/api/auth/register",
        json={
            "username": "inviteduser2",
            "email": "invited2@example.com",
            "password": "password123",
            "invite_code": code
        }
    )
    assert reg_res2.status_code == 400

    # 5. Create an expired invite code
    create_res2 = client.post(
        "/api/admin/invite-codes",
        json={"expires_in_hours": 24},
        cookies=admin_cookies,
    )
    code_expired = create_res2.json()["code"]

    # Manually backdate the invite code expiration date in the database
    code_db = db.scalar(select(InviteCode).where(InviteCode.code == code_expired))
    code_db.expires_at = datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=1)
    db.commit()

    # Try registering with expired code -> fails
    reg_res3 = client.post(
        "/api/auth/register",
        json={
            "username": "inviteduser3",
            "email": "invited3@example.com",
            "password": "password123",
            "invite_code": code_expired
        }
    )
    assert reg_res3.status_code == 400


def test_configs_encryption_and_masking(client: TestClient, admin_test_setup, db):
    admin_cookies = admin_test_setup["admin"]

    # Ensure system_configs key is present (pre-seeded)
    db.merge(SystemConfig(config_key="qwen_api_key", description="Qwen Key"))
    db.commit()

    # 1. Update sensitive config (qwen_api_key)
    patch_res = client.patch(
        "/api/admin/configs/qwen_api_key",
        json={"config_val": "sk-my-secret-qwen-key-goes-here-12345"},
        cookies=admin_cookies,
    )
    assert patch_res.status_code == 200
    # Response value should be masked
    assert patch_res.json()["config_val"].startswith("sk-")
    assert "****" in patch_res.json()["config_val"]

    # 2. Check database is encrypted
    db_config = db.scalar(select(SystemConfig).where(SystemConfig.config_key == "qwen_api_key"))
    # Confirm it is NOT saved in plaintext
    assert "secret" not in db_config.config_val
    # Confirm it can be decrypted to the original plaintext
    assert decrypt_value(db_config.config_val) == "sk-my-secret-qwen-key-goes-here-12345"

    # 3. List configs -> should return masked value
    list_res = client.get("/api/admin/configs", cookies=admin_cookies)
    assert list_res.status_code == 200
    qwen_config = next(c for c in list_res.json() if c["config_key"] == "qwen_api_key")
    assert "****" in qwen_config["config_val"]


def test_storage_quota_updates(client: TestClient, admin_test_setup, db):
    admin_cookies = admin_test_setup["admin"]

    # 1. Get quota
    get_res = client.get("/api/admin/storage-quota", cookies=admin_cookies)
    assert get_res.status_code == 200
    assert "max_size_mb" in get_res.json()

    # 2. Update quota
    patch_res = client.patch(
        "/api/admin/storage-quota",
        json={"max_size_mb": 5120.0},
        cookies=admin_cookies,
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["max_size_mb"] == 5120.0

    # Verify DB update
    quota_db = db.scalar(select(StorageQuota))
    assert float(quota_db.max_size_mb) == 5120.0


def test_mcp_blog_token_management(client: TestClient, admin_test_setup, db):
    admin_cookies = admin_test_setup["admin"]
    admin_id = db.scalar(select(User.id).where(User.username == "adminuser"))

    create_res = client.post(
        "/api/admin/mcp-blog/tokens",
        json={"label": "Codex desktop", "author_id": admin_id, "allow_auto_publish": False},
        cookies=admin_cookies,
    )
    assert create_res.status_code == 201
    created = create_res.json()
    assert created["token"].startswith("lmb_mcp_")
    assert "token_hash" not in created

    stored = db.scalar(select(MCPBlogToken).where(MCPBlogToken.id == created["id"]))
    assert stored is not None
    assert created["token"] not in stored.token_hash
    assert stored.is_active is True

    identity = resolve_mcp_blog_identity(db, created["token"], record_usage=False)
    assert identity is not None
    assert identity.author_id == admin_id

    list_res = client.get("/api/admin/mcp-blog/tokens", cookies=admin_cookies)
    assert list_res.status_code == 200
    assert "token" not in list_res.json()[0]

    disable_res = client.patch(
        f"/api/admin/mcp-blog/tokens/{created['id']}",
        json={"is_active": False},
        cookies=admin_cookies,
    )
    assert disable_res.status_code == 200
    assert disable_res.json()["is_active"] is False

    assert resolve_mcp_blog_identity(db, created["token"], record_usage=False) is None


def test_mcp_library_token_management(client: TestClient, admin_test_setup, db):
    admin_cookies = admin_test_setup["admin"]
    admin_id = db.scalar(select(User.id).where(User.username == "adminuser"))
    create_res = client.post(
        "/api/admin/mcp-library/tokens",
        json={"label": "Library assistant"},
        cookies=admin_cookies,
    )
    assert create_res.status_code == 201
    created = create_res.json()
    assert created["token"].startswith("lml_mcp_")
    assert "token_hash" not in created
    stored = db.scalar(select(MCPLibraryToken).where(MCPLibraryToken.id == created["id"]))
    assert stored is not None
    assert created["token"] not in stored.token_hash
    identity = resolve_mcp_library_identity(db, created["token"], record_usage=False)
    assert identity is not None
    assert identity.user_id == admin_id
    assert client.get("/api/admin/mcp-library/tokens", cookies=admin_cookies).status_code == 200
    disabled = client.patch(
        f"/api/admin/mcp-library/tokens/{created['id']}",
        json={"is_active": False},
        cookies=admin_cookies,
    )
    assert disabled.status_code == 200
    assert resolve_mcp_library_identity(db, created["token"], record_usage=False) is None


def test_admin_authorization_restrictions(client: TestClient, admin_test_setup):
    normal_cookies = admin_test_setup["normal"]

    # Regular users should get 403 Forbidden
    assert client.get("/api/admin/users", cookies=normal_cookies).status_code == 403
    assert client.patch("/api/admin/users/1", json={"is_active": False}, cookies=normal_cookies).status_code == 403
    assert client.get("/api/admin/configs", cookies=normal_cookies).status_code == 403
    assert client.patch("/api/admin/configs/qwen_api_key", json={"config_val": "new"}, cookies=normal_cookies).status_code == 403
    assert client.get("/api/admin/invite-codes", cookies=normal_cookies).status_code == 403
    assert client.post("/api/admin/invite-codes", json={"expires_in_hours": 24}, cookies=normal_cookies).status_code == 403
    assert client.get("/api/admin/storage-quota", cookies=normal_cookies).status_code == 403
    assert client.patch("/api/admin/storage-quota", json={"max_size_mb": 100.0}, cookies=normal_cookies).status_code == 403
    assert client.get("/api/admin/mcp-blog/tokens", cookies=normal_cookies).status_code == 403
    assert client.post("/api/admin/mcp-blog/tokens", json={"label": "nope", "author_id": 1}, cookies=normal_cookies).status_code == 403
    assert client.get("/api/admin/mcp-library/tokens", cookies=normal_cookies).status_code == 403
    assert client.post("/api/admin/mcp-library/tokens", json={"label": "nope"}, cookies=normal_cookies).status_code == 403
