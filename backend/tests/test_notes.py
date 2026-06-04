from datetime import datetime, timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.models.space import SpaceMember, SpaceMemberRole
from app.models.user import User
from app.models.note import Note


@pytest.fixture
def notes_test_setup(client: TestClient, db):
    # Register and login User 1
    client.post(
        "/api/auth/register",
        json={"username": "noteuser1", "email": "n1@example.com", "password": "password123"},
    )
    res1 = client.post("/api/auth/login", json={"username_or_email": "noteuser1", "password": "password123"})
    user1_cookies = res1.cookies

    # Register and login User 2
    client.post(
        "/api/auth/register",
        json={"username": "noteuser2", "email": "n2@example.com", "password": "password123"},
    )
    res2 = client.post("/api/auth/login", json={"username_or_email": "noteuser2", "password": "password123"})
    user2_cookies = res2.cookies

    # Register and login User 3 (Not in space)
    client.post(
        "/api/auth/register",
        json={"username": "noteuser3", "email": "n3@example.com", "password": "password123"},
    )
    res3 = client.post("/api/auth/login", json={"username_or_email": "noteuser3", "password": "password123"})
    user3_cookies = res3.cookies

    # User 1 creates a space
    space_res = client.post(
        "/api/spaces",
        json={"name": "记录空间", "type": "couple"},
        cookies=user1_cookies,
    )
    space_id = space_res.json()["id"]

    # Retrieve User 2 and add as member in space
    user2_db = db.scalar(select(User).where(User.username == "noteuser2"))
    member2 = SpaceMember(
        space_id=space_id,
        user_id=user2_db.id,
        role=SpaceMemberRole.MEMBER
    )
    db.add(member2)
    db.commit()

    return {
        "user1": user1_cookies,
        "user2": user2_cookies,
        "user3": user3_cookies,
        "space_id": space_id
    }


def test_note_crud(client: TestClient, notes_test_setup):
    u1 = notes_test_setup["user1"]
    u2 = notes_test_setup["user2"]
    space_id = notes_test_setup["space_id"]

    # 1. Create a note (User 1)
    res = client.post(
        f"/api/spaces/{space_id}/notes",
        json={"title": "测试笔记", "content": "Markdown 内容", "cover_url": "http://img.com/cover.jpg"},
        cookies=u1,
    )
    assert res.status_code == 201
    note_id = res.json()["id"]
    assert res.json()["title"] == "测试笔记"
    assert res.json()["author"]["username"] == "noteuser1"

    # 2. Get the note (User 2)
    get_res = client.get(f"/api/spaces/{space_id}/notes/{note_id}", cookies=u2)
    assert get_res.status_code == 200
    assert get_res.json()["title"] == "测试笔记"
    assert get_res.json()["content"] == "Markdown 内容"

    # 3. List notes (User 2)
    list_res = client.get(f"/api/spaces/{space_id}/notes", cookies=u2)
    assert list_res.status_code == 200
    assert len(list_res.json()) == 1

    # 4. Update the note (User 2)
    patch_res = client.patch(
        f"/api/spaces/{space_id}/notes/{note_id}",
        json={"title": "修改后的笔记", "content": "更新后的内容"},
        cookies=u2,
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["title"] == "修改后的笔记"
    assert patch_res.json()["content"] == "更新后的内容"
    assert patch_res.json()["lock_by"] is not None

    # 5. Delete the note (User 1)
    del_res = client.delete(f"/api/spaces/{space_id}/notes/{note_id}", cookies=u1)
    assert del_res.status_code == 200

    # 6. Verify deleted
    get_del = client.get(f"/api/spaces/{space_id}/notes/{note_id}", cookies=u1)
    assert get_del.status_code == 404


def test_note_access_control(client: TestClient, notes_test_setup):
    u1 = notes_test_setup["user1"]
    u3 = notes_test_setup["user3"]
    space_id = notes_test_setup["space_id"]

    # User 1 creates note
    res = client.post(
        f"/api/spaces/{space_id}/notes",
        json={"title": "私密笔记", "content": "内容"},
        cookies=u1,
    )
    note_id = res.json()["id"]

    # User 3 (non-member) tries to list
    assert client.get(f"/api/spaces/{space_id}/notes", cookies=u3).status_code == 403
    # User 3 tries to create
    assert client.post(
        f"/api/spaces/{space_id}/notes",
        json={"title": "窃取创建", "content": "内容"},
        cookies=u3,
    ).status_code == 403
    # User 3 tries to get
    assert client.get(f"/api/spaces/{space_id}/notes/{note_id}", cookies=u3).status_code == 403
    # User 3 tries to update
    assert client.patch(
        f"/api/spaces/{space_id}/notes/{note_id}",
        json={"title": "试图篡改"},
        cookies=u3,
    ).status_code == 403
    # User 3 tries to delete
    assert client.delete(f"/api/spaces/{space_id}/notes/{note_id}", cookies=u3).status_code == 403


def test_note_locking_mechanism(client: TestClient, notes_test_setup, db):
    u1 = notes_test_setup["user1"]
    u2 = notes_test_setup["user2"]
    space_id = notes_test_setup["space_id"]

    # Create note
    res = client.post(
        f"/api/spaces/{space_id}/notes",
        json={"title": "锁定笔记", "content": "内容"},
        cookies=u1,
    )
    note_id = res.json()["id"]

    # User 1 acquires lock
    lock_res = client.post(f"/api/spaces/{space_id}/notes/{note_id}/lock", cookies=u1)
    assert lock_res.status_code == 200
    assert lock_res.json()["status"] == "ok"

    # User 2 tries to update -> Should be blocked with 409
    patch_res = client.patch(
        f"/api/spaces/{space_id}/notes/{note_id}",
        json={"title": "修改标题"},
        cookies=u2,
    )
    assert patch_res.status_code == 409
    assert "编辑中" in patch_res.json()["detail"]

    # User 2 tries to acquire lock -> Should be blocked with 409
    lock2_res = client.post(f"/api/spaces/{space_id}/notes/{note_id}/lock", cookies=u2)
    assert lock2_res.status_code == 409

    # User 1 heartbeats lock -> Success
    hb_res = client.post(f"/api/spaces/{space_id}/notes/{note_id}/heartbeat", cookies=u1)
    assert hb_res.status_code == 200

    # User 2 heartbeats lock -> Should fail with 409
    hb2_res = client.post(f"/api/spaces/{space_id}/notes/{note_id}/heartbeat", cookies=u2)
    assert hb2_res.status_code == 409

    # User 2 tries to release lock -> Success (safe release/noop)
    unl2_res = client.delete(f"/api/spaces/{space_id}/notes/{note_id}/lock", cookies=u2)
    assert unl2_res.status_code == 200

    # User 1 releases lock -> Success
    unl_res = client.delete(f"/api/spaces/{space_id}/notes/{note_id}/lock", cookies=u1)
    assert unl_res.status_code == 200

    # User 2 can now lock
    lock2_again = client.post(f"/api/spaces/{space_id}/notes/{note_id}/lock", cookies=u2)
    assert lock2_again.status_code == 200


def test_lock_timeout_and_takeover(client: TestClient, notes_test_setup, db):
    u1 = notes_test_setup["user1"]
    u2 = notes_test_setup["user2"]
    space_id = notes_test_setup["space_id"]

    # Create note
    res = client.post(
        f"/api/spaces/{space_id}/notes",
        json={"title": "超时笔记", "content": "内容"},
        cookies=u1,
    )
    note_id = res.json()["id"]

    # User 1 acquires lock
    client.post(f"/api/spaces/{space_id}/notes/{note_id}/lock", cookies=u1)

    # Modify DB value of lock_at to be 31 minutes ago
    note_db = db.scalar(select(Note).where(Note.id == note_id))
    note_db.lock_at = datetime.utcnow() - timedelta(minutes=31)
    db.commit()

    # User 2 tries to acquire lock -> Should succeed because lock expired
    lock_res = client.post(f"/api/spaces/{space_id}/notes/{note_id}/lock", cookies=u2)
    assert lock_res.status_code == 200
    assert lock_res.json()["status"] == "ok"

    # Verify that User 2 now holds the lock
    note_db_refreshed = db.scalar(select(Note).where(Note.id == note_id))
    assert note_db_refreshed.lock_by == db.scalar(select(User.id).where(User.username == "noteuser2"))

    # Reset DB lock to User 1 but expired
    note_db_refreshed.lock_by = db.scalar(select(User.id).where(User.username == "noteuser1"))
    note_db_refreshed.lock_at = datetime.utcnow() - timedelta(minutes=31)
    db.commit()

    # User 2 tries to PATCH directly -> Should succeed because lock expired, and auto-acquire lock for User 2
    patch_res = client.patch(
        f"/api/spaces/{space_id}/notes/{note_id}",
        json={"title": "自动抢占修改"},
        cookies=u2,
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["title"] == "自动抢占修改"
    assert patch_res.json()["lock_by"] == db.scalar(select(User.id).where(User.username == "noteuser2"))
