import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def space_user(client: TestClient, db):
    """Register and login a user for space tests."""
    user_data = {
        "username": "spaceowner",
        "email": "spaceowner@example.com",
        "password": "password123",
        "display_name": "Space Owner",
    }
    client.post("/api/auth/register", json=user_data)
    login_res = client.post(
        "/api/auth/login",
        json={"username_or_email": "spaceowner", "password": "password123"},
    )
    return login_res.cookies


@pytest.fixture
def second_user(client: TestClient, db):
    """Register and login a second user."""
    user_data = {
        "username": "spacemember",
        "email": "spacemember@example.com",
        "password": "password456",
        "display_name": "Space Member",
    }
    client.post("/api/auth/register", json=user_data)
    login_res = client.post(
        "/api/auth/login",
        json={"username_or_email": "spacemember", "password": "password456"},
    )
    return login_res.cookies


def test_create_space(client: TestClient, space_user):
    res = client.post(
        "/api/spaces",
        json={
            "name": "测试空间",
            "type": "couple",
            "description": "这是一个测试空间",
        },
        cookies=space_user,
    )
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "测试空间"
    assert data["type"] == "couple"
    assert data["member_count"] == 1


def test_list_my_spaces(client: TestClient, space_user):
    # Create two spaces
    client.post(
        "/api/spaces",
        json={"name": "空间 A", "type": "family"},
        cookies=space_user,
    )
    client.post(
        "/api/spaces",
        json={"name": "空间 B", "type": "friends"},
        cookies=space_user,
    )

    res = client.get("/api/spaces", cookies=space_user)
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 2


def test_get_space_detail(client: TestClient, space_user):
    create_res = client.post(
        "/api/spaces",
        json={"name": "详情测试", "type": "couple"},
        cookies=space_user,
    )
    space_id = create_res.json()["id"]

    res = client.get(f"/api/spaces/{space_id}", cookies=space_user)
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "详情测试"
    assert len(data["members"]) == 1
    assert data["members"][0]["role"] == "owner"


def test_update_space(client: TestClient, space_user):
    create_res = client.post(
        "/api/spaces",
        json={"name": "待修改", "type": "family"},
        cookies=space_user,
    )
    space_id = create_res.json()["id"]

    res = client.patch(
        f"/api/spaces/{space_id}",
        json={"name": "已修改", "description": "更新描述"},
        cookies=space_user,
    )
    assert res.status_code == 200
    assert res.json()["name"] == "已修改"


def test_delete_space(client: TestClient, space_user):
    create_res = client.post(
        "/api/spaces",
        json={"name": "待删除", "type": "friends"},
        cookies=space_user,
    )
    space_id = create_res.json()["id"]

    res = client.delete(f"/api/spaces/{space_id}", cookies=space_user)
    assert res.status_code == 200
    assert "删除" in res.json()["message"]

    # Verify it's gone
    res2 = client.get(f"/api/spaces/{space_id}", cookies=space_user)
    assert res2.status_code == 404


def test_create_invite_and_join(client: TestClient, space_user, second_user):
    # Owner creates space
    create_res = client.post(
        "/api/spaces",
        json={"name": "邀请测试", "type": "couple"},
        cookies=space_user,
    )
    space_id = create_res.json()["id"]

    # Owner creates invite code
    invite_res = client.post(
        f"/api/spaces/{space_id}/invites",
        json={"expires_in_hours": 24, "max_uses": 5},
        cookies=space_user,
    )
    assert invite_res.status_code == 201
    invite_data = invite_res.json()
    assert invite_data["max_uses"] == 5
    assert invite_data["used_count"] == 0
    code = invite_data["code"]

    # Second user joins via code
    join_res = client.post(
        "/api/spaces/join",
        json={"code": code},
        cookies=second_user,
    )
    assert join_res.status_code == 200
    assert join_res.json()["member_count"] == 2

    # Verify invite used_count incremented
    list_res = client.get(f"/api/spaces/{space_id}/invites", cookies=space_user)
    assert list_res.status_code == 200
    invites = list_res.json()
    matched = [i for i in invites if i["code"] == code]
    assert matched[0]["used_count"] == 1


def test_join_already_member(client: TestClient, space_user, second_user):
    create_res = client.post(
        "/api/spaces",
        json={"name": "重复加入", "type": "friends"},
        cookies=space_user,
    )
    space_id = create_res.json()["id"]

    invite_res = client.post(
        f"/api/spaces/{space_id}/invites",
        json={"max_uses": 5},
        cookies=space_user,
    )
    code = invite_res.json()["code"]

    # First join succeeds
    client.post("/api/spaces/join", json={"code": code}, cookies=second_user)

    # Second join fails
    res = client.post("/api/spaces/join", json={"code": code}, cookies=second_user)
    assert res.status_code == 400
    assert "已经是" in res.json()["detail"]


def test_invite_max_uses_exhausted(client: TestClient, space_user, second_user):
    create_res = client.post(
        "/api/spaces",
        json={"name": "限制测试", "type": "family"},
        cookies=space_user,
    )
    space_id = create_res.json()["id"]

    invite_res = client.post(
        f"/api/spaces/{space_id}/invites",
        json={"max_uses": 1},
        cookies=space_user,
    )
    code = invite_res.json()["code"]

    # First user joins
    client.post("/api/spaces/join", json={"code": code}, cookies=second_user)

    # Register a third user
    third_data = {
        "username": "thirduser",
        "email": "third@example.com",
        "password": "password789",
    }
    client.post("/api/auth/register", json=third_data)
    third_login = client.post(
        "/api/auth/login",
        json={"username_or_email": "thirduser", "password": "password789"},
    )
    third_cookies = third_login.cookies

    # Third user join fails (max_uses=1, already used once)
    res = client.post("/api/spaces/join", json={"code": code}, cookies=third_cookies)
    assert res.status_code == 400
    assert "最大使用次数" in res.json()["detail"]


def test_remove_member(client: TestClient, space_user, second_user):
    create_res = client.post(
        "/api/spaces",
        json={"name": "移除成员", "type": "couple"},
        cookies=space_user,
    )
    space_id = create_res.json()["id"]

    # Invite and join
    invite_res = client.post(
        f"/api/spaces/{space_id}/invites",
        json={"max_uses": 1},
        cookies=space_user,
    )
    code = invite_res.json()["code"]
    client.post("/api/spaces/join", json={"code": code}, cookies=second_user)

    # Get second user id from detail
    detail = client.get(f"/api/spaces/{space_id}", cookies=space_user).json()
    member_user_id = [m for m in detail["members"] if m["role"] == "member"][0]["user_id"]

    # Remove member
    res = client.delete(f"/api/spaces/{space_id}/members/{member_user_id}", cookies=space_user)
    assert res.status_code == 200
    assert "移除" in res.json()["message"]

    # Verify count decreased
    detail2 = client.get(f"/api/spaces/{space_id}", cookies=space_user).json()
    assert detail2["member_count"] == 1


def test_non_member_cannot_access(client: TestClient, space_user, second_user):
    create_res = client.post(
        "/api/spaces",
        json={"name": "禁止访问", "type": "family"},
        cookies=space_user,
    )
    space_id = create_res.json()["id"]

    # Second user tries to access without being a member
    res = client.get(f"/api/spaces/{space_id}", cookies=second_user)
    assert res.status_code == 403


def test_non_owner_cannot_update(client: TestClient, space_user, second_user):
    create_res = client.post(
        "/api/spaces",
        json={"name": "权限测试", "type": "couple"},
        cookies=space_user,
    )
    space_id = create_res.json()["id"]

    # Invite second user
    invite_res = client.post(
        f"/api/spaces/{space_id}/invites", json={"max_uses": 1}, cookies=space_user
    )
    client.post("/api/spaces/join", json={"code": invite_res.json()["code"]}, cookies=second_user)

    # Member tries to update space
    res = client.patch(
        f"/api/spaces/{space_id}",
        json={"name": "恶意修改"},
        cookies=second_user,
    )
    assert res.status_code == 403
