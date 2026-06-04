from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.models.chat import ChatModelType, ChatSession


@pytest.fixture
def auth_headers(client: TestClient, db):
    # Register and login a user to get auth token / cookies
    user_data = {
        "username": "chattester",
        "email": "chattester@example.com",
        "password": "password123",
        "display_name": "Chat Tester",
    }
    client.post("/api/auth/register", json=user_data)
    login_res = client.post(
        "/api/auth/login",
        json={"username_or_email": "chattester", "password": "password123"},
    )
    # The login endpoint sets HTTPOnly cookies on client, so client holds the session cookie.
    return login_res.cookies


def test_create_session(client: TestClient, auth_headers):
    # Test session creation
    res = client.post(
        "/api/chat/sessions",
        json={"title": "测试对话", "model": "qwen"},
        cookies=auth_headers,
    )
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == "测试对话"
    assert data["model"] == "qwen"
    assert "id" in data


def test_list_sessions(client: TestClient, auth_headers):
    # Create two sessions
    client.post(
        "/api/chat/sessions",
        json={"title": "Session 1", "model": "qwen"},
        cookies=auth_headers,
    )
    client.post(
        "/api/chat/sessions",
        json={"title": "Session 2", "model": "deepseek"},
        cookies=auth_headers,
    )

    res = client.get("/api/chat/sessions", cookies=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 2
    assert any(s["title"] == "Session 1" for s in data)
    assert any(s["title"] == "Session 2" for s in data)


def test_get_session_detail(client: TestClient, auth_headers):
    res_create = client.post(
        "/api/chat/sessions",
        json={"title": "Detail Session", "model": "qwen"},
        cookies=auth_headers,
    )
    session_id = res_create.json()["id"]

    res = client.get(f"/api/chat/sessions/{session_id}", cookies=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["title"] == "Detail Session"
    assert "messages" in data
    assert len(data["messages"]) == 0


def test_deepseek_block_images(client: TestClient, auth_headers):
    res_create = client.post(
        "/api/chat/sessions",
        json={"title": "DS Image Test", "model": "deepseek"},
        cookies=auth_headers,
    )
    session_id = res_create.json()["id"]

    # Send message with attachments (image url) to deepseek session -> should return 400
    res = client.post(
        f"/api/chat/sessions/{session_id}/messages",
        json={
            "content": "Look at this image",
            "attachments": ["https://example.com/image.png"],
        },
        cookies=auth_headers,
    )
    assert res.status_code == 400
    assert "不支持图片" in res.json()["detail"]


@patch("app.services.llm.OpenAI")
def test_send_message_stream(mock_openai_class, client: TestClient, auth_headers):
    # Setup mock OpenAI client response
    mock_client = MagicMock()
    mock_openai_class.return_value = mock_client

    # Mock choice delta
    mock_chunk_1 = MagicMock()
    mock_chunk_1.choices = [MagicMock()]
    mock_chunk_1.choices[0].delta.content = "Hello"

    mock_chunk_2 = MagicMock()
    mock_chunk_2.choices = [MagicMock()]
    mock_chunk_2.choices[0].delta.content = " world!"

    mock_client.chat.completions.create.return_value = [mock_chunk_1, mock_chunk_2]

    # First, create a session config in system_configs to prevent ValueError about missing key
    # Wait, the database during test is empty, but our endpoint uses get_system_config
    # which queries system_configs table. Let's patch get_llm_client_and_model or just let system configs return mock keys.
    with patch("app.services.llm.get_system_config") as mock_get_cfg:
        mock_get_cfg.return_value = "mock_key"

        # Create session
        res_create = client.post(
            "/api/chat/sessions",
            json={"title": "Stream Test", "model": "qwen"},
            cookies=auth_headers,
        )
        session_id = res_create.json()["id"]

        # Send message
        res = client.post(
            f"/api/chat/sessions/{session_id}/messages",
            json={"content": "Hi"},
            cookies=auth_headers,
        )

        assert res.status_code == 200
        assert "text/event-stream" in res.headers["content-type"]

        # Read the event stream output
        content = res.text
        assert "chunk" in content
        assert "Hello" in content
        assert "world!" in content
        assert "done" in content
