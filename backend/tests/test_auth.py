def test_auth_flow(client):
    # 1. Register a user
    reg_data = {
        "username": "testuser",
        "email": "test@example.com",
        "password": "strongpassword123",
        "display_name": "Test User",
    }
    response = client.post("/api/auth/register", json=reg_data)
    assert response.status_code == 201
    assert response.json()["username"] == "testuser"
    assert response.json()["email"] == "test@example.com"
    assert "password" not in response.json()

    # 2. Duplicate username
    response = client.post(
        "/api/auth/register",
        json={
            "username": "testuser",
            "email": "test2@example.com",
            "password": "strongpassword123",
        },
    )
    assert response.status_code == 400
    assert "用户名已存在" in response.json()["detail"]

    # 3. Duplicate email
    response = client.post(
        "/api/auth/register",
        json={
            "username": "testuser2",
            "email": "test@example.com",
            "password": "strongpassword123",
        },
    )
    assert response.status_code == 400
    assert "邮箱已被注册" in response.json()["detail"]

    # 4. Correct login
    login_data = {"username_or_email": "testuser", "password": "strongpassword123"}
    response = client.post("/api/auth/login", json=login_data)
    assert response.status_code == 200
    assert "access_token" in response.json()
    assert "access_token" in client.cookies
    assert "refresh_token" in client.cookies

    # 5. Correct login via email
    response = client.post(
        "/api/auth/login",
        json={"username_or_email": "test@example.com", "password": "strongpassword123"},
    )
    assert response.status_code == 200

    # 6. Wrong password login
    response = client.post(
        "/api/auth/login",
        json={"username_or_email": "testuser", "password": "wrongpassword"},
    )
    assert response.status_code == 401
    assert "用户名、邮箱或密码错误" in response.json()["detail"]

    # 7. Get me
    response = client.get("/api/auth/me")
    assert response.status_code == 200
    assert response.json()["username"] == "testuser"

    # 8. Refresh token
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

    # 9. Logout
    response = client.post("/api/auth/logout")
    assert response.status_code == 200

    # Check cookies are cleared/expired
    access_token_cookie = client.cookies.get("access_token")
    refresh_token_cookie = client.cookies.get("refresh_token")
    assert access_token_cookie is None or access_token_cookie == ""
    assert refresh_token_cookie is None or refresh_token_cookie == ""

    response = client.get("/api/auth/me")
    assert response.status_code == 401
