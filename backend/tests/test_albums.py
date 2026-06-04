import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.models.storage_quota import StorageQuota


@pytest.fixture
def space_users(client: TestClient, db):
    """Register and login two users, one creates a space, the other is not in the space."""
    # User 1
    client.post(
        "/api/auth/register",
        json={"username": "albumuser1", "email": "a1@example.com", "password": "password123"},
    )
    res1 = client.post("/api/auth/login", json={"username_or_email": "albumuser1", "password": "password123"})
    user1_cookies = res1.cookies

    # User 2
    client.post(
        "/api/auth/register",
        json={"username": "albumuser2", "email": "a2@example.com", "password": "password123"},
    )
    res2 = client.post("/api/auth/login", json={"username_or_email": "albumuser2", "password": "password123"})
    user2_cookies = res2.cookies

    # User 1 creates a space
    space_res = client.post(
        "/api/spaces",
        json={"name": "相册空间", "type": "couple"},
        cookies=user1_cookies,
    )
    space_id = space_res.json()["id"]

    return {"user1": user1_cookies, "user2": user2_cookies, "space_id": space_id}


def test_create_and_list_albums(client: TestClient, space_users):
    user1_cookies = space_users["user1"]
    space_id = space_users["space_id"]

    # Create album
    res = client.post(
        f"/api/spaces/{space_id}/albums",
        json={"name": "夏日回忆"},
        cookies=user1_cookies,
    )
    assert res.status_code == 201
    assert res.json()["name"] == "夏日回忆"

    # List albums
    list_res = client.get(f"/api/spaces/{space_id}/albums", cookies=user1_cookies)
    assert list_res.status_code == 200
    assert len(list_res.json()) == 1


def test_album_access_control(client: TestClient, space_users):
    user1_cookies = space_users["user1"]
    user2_cookies = space_users["user2"]
    space_id = space_users["space_id"]

    res = client.post(
        f"/api/spaces/{space_id}/albums",
        json={"name": "私密相册"},
        cookies=user1_cookies,
    )
    album_id = res.json()["id"]

    # User 2 tries to access
    get_res = client.get(f"/api/spaces/{space_id}/albums/{album_id}", cookies=user2_cookies)
    assert get_res.status_code == 403


def test_update_and_delete_album(client: TestClient, space_users):
    user1_cookies = space_users["user1"]
    space_id = space_users["space_id"]

    res = client.post(
        f"/api/spaces/{space_id}/albums",
        json={"name": "待修改相册"},
        cookies=user1_cookies,
    )
    album_id = res.json()["id"]

    # Update
    patch_res = client.patch(
        f"/api/spaces/{space_id}/albums/{album_id}",
        json={"name": "已修改相册"},
        cookies=user1_cookies,
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["name"] == "已修改相册"

    # Delete
    del_res = client.delete(f"/api/spaces/{space_id}/albums/{album_id}", cookies=user1_cookies)
    assert del_res.status_code == 200

    get_res = client.get(f"/api/spaces/{space_id}/albums/{album_id}", cookies=user1_cookies)
    assert get_res.status_code == 404


def test_upload_and_delete_photo(client: TestClient, space_users, monkeypatch, db):
    user1_cookies = space_users["user1"]
    space_id = space_users["space_id"]

    # Create album
    album_id = client.post(
        f"/api/spaces/{space_id}/albums",
        json={"name": "测试图片相册"},
        cookies=user1_cookies,
    ).json()["id"]

    # Config lsky token so upload doesn't fail early
    # Must use super admin to configure
    client.post("/api/auth/login", json={"username_or_email": "admin", "password": "admin_password123"})
    # Assuming the DB was initialized with a root user, we'll just mock the config manually for test brevity
    from app.models.system_config import SystemConfig
    from app.utils.crypto import encrypt_value
    
    db.add(SystemConfig(config_key="lsky_api_url", config_val="http://fake-lsky.com"))
    db.add(SystemConfig(config_key="lsky_api_token", config_val=encrypt_value("fake-token")))
    db.commit()

    # Mock httpx.AsyncClient.post
    class MockResponse:
        def raise_for_status(self):
            pass
        def json(self):
            return {
                "status": True,
                "data": {
                    "links": {
                        "url": "http://fake-lsky.com/image.jpg",
                        "thumbnail_url": "http://fake-lsky.com/thumb.jpg"
                    }
                }
            }
            
    async def mock_post(*args, **kwargs):
        return MockResponse()

    monkeypatch.setattr("httpx.AsyncClient.post", mock_post)

    # 1. Upload photo
    files = {"file": ("test.jpg", b"fake image content" * 1024, "image/jpeg")}
    upload_res = client.post(
        f"/api/spaces/{space_id}/albums/{album_id}/photos",
        files=files,
        cookies=user1_cookies,
    )
    assert upload_res.status_code == 201
    photo_data = upload_res.json()
    assert photo_data["url"] == "http://fake-lsky.com/image.jpg"
    photo_id = photo_data["id"]

    # Check quota usage increased
    quota = db.scalar(select(StorageQuota))
    assert float(quota.used_size_mb) > 0.0

    # 2. Delete photo
    del_res = client.delete(
        f"/api/spaces/{space_id}/albums/{album_id}/photos/{photo_id}",
        cookies=user1_cookies,
    )
    assert del_res.status_code == 200
    
    # Check quota usage decreased
    db.refresh(quota)
    assert float(quota.used_size_mb) == 0.0
