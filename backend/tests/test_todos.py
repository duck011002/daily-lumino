def test_todo_api_rejects_unknown_priority_and_status(client, user_cookies_factory):
    _, cookies = user_cookies_factory("todo-validation")

    invalid_priority = client.post(
        "/api/todos",
        cookies=cookies,
        json={"title": "测试", "priority": "urgent"},
    )
    invalid_status = client.post(
        "/api/todos",
        cookies=cookies,
        json={"title": "测试", "status": "doing"},
    )
    invalid_filter = client.get(
        "/api/todos?status_filter=doing",
        cookies=cookies,
    )

    assert invalid_priority.status_code == 422
    assert invalid_status.status_code == 422
    assert invalid_filter.status_code == 422


def test_todo_api_is_user_private(client, user_cookies_factory):
    _, owner_cookies = user_cookies_factory("todo-owner")
    _, stranger_cookies = user_cookies_factory("todo-stranger")

    created = client.post(
        "/api/todos",
        cookies=owner_cookies,
        json={"title": "仅自己可见", "priority": "high"},
    )
    assert created.status_code == 201
    todo_id = created.json()["id"]

    stranger_list = client.get("/api/todos", cookies=stranger_cookies)
    assert stranger_list.status_code == 200
    assert stranger_list.json() == []
    assert client.patch(
        f"/api/todos/{todo_id}",
        cookies=stranger_cookies,
        json={"status": "completed"},
    ).status_code == 404
    assert client.delete(
        f"/api/todos/{todo_id}", cookies=stranger_cookies
    ).status_code == 404


def test_todo_create_and_update_round_trip(client, user_cookies_factory):
    _, cookies = user_cookies_factory("todo-round-trip")
    created = client.post(
        "/api/todos",
        cookies=cookies,
        json={
            "title": "整理文章",
            "description": "补充结论",
            "priority": "medium",
            "status": "pending",
        },
    )
    assert created.status_code == 201

    updated = client.patch(
        f"/api/todos/{created.json()['id']}",
        cookies=cookies,
        json={"status": "completed"},
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "completed"
