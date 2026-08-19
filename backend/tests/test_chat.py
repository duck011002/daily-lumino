from unittest.mock import MagicMock, patch
from datetime import datetime
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.models.chat import ChatModelType, ChatSession
from app.models.invite_code import InviteCode
from app.models.user import User
from app.services.auth import hash_password
from app.schemas.actions import ActionReceipt, InterpretActionResponse
from app.schemas.private_agent import PrivateAgentDecision
from app.models.blog import BlogPost
from sqlalchemy import func, select


@pytest.fixture
def auth_headers(client: TestClient, db):
    # Register and login a user to get auth token / cookies
    suffix = uuid4().hex[:10]
    root_user = User(
        username=f"chat-root-{suffix}",
        email=f"chat-root-{suffix}@example.com",
        password=hash_password("password123"),
        display_name="Chat Root",
        is_root=True,
        is_active=True,
    )
    db.add(root_user)
    db.flush()
    invite_code = f"chat-invite-{suffix}"
    db.add(InviteCode(code=invite_code, created_by=root_user.id))
    db.commit()

    user_data = {
        "username": f"chattester-{suffix}",
        "email": f"chattester-{suffix}@example.com",
        "password": "password123",
        "display_name": "Chat Tester",
        "invite_code": invite_code,
    }
    client.post("/api/auth/register", json=user_data)
    login_res = client.post(
        "/api/auth/login",
        json={"username_or_email": user_data["username"], "password": "password123"},
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

        with patch(
            "app.routers.chat.route_private_agent",
            return_value=PrivateAgentDecision(route="chat"),
        ) as route_mock:
            res = client.post(
                f"/api/chat/sessions/{session_id}/messages",
                json={"content": "Hi"},
                cookies=auth_headers,
            )
        route_mock.assert_called_once()

        assert res.status_code == 200
        assert "text/event-stream" in res.headers["content-type"]

        # Read the event stream output
        content = res.text
        assert "chunk" in content
        assert "Hello" in content
        assert "world!" in content
        assert "done" in content


@patch("app.services.llm.OpenAI")
def test_send_message_updates_tokens_used(mock_openai_class, client: TestClient, auth_headers, db):
    mock_client = MagicMock()
    mock_openai_class.return_value = mock_client

    mock_chunk_1 = MagicMock()
    mock_chunk_1.choices = [MagicMock()]
    mock_chunk_1.choices[0].delta.content = "Hi"

    mock_client.chat.completions.create.return_value = [mock_chunk_1]

    with patch("app.services.llm.get_system_config") as mock_get_cfg:
        mock_get_cfg.return_value = "mock_key"

        # Create session
        res_create = client.post(
            "/api/chat/sessions",
            json={"title": "Token Test", "model": "qwen"},
            cookies=auth_headers,
        )
        session_id = res_create.json()["id"]

        with patch(
            "app.routers.chat.route_private_agent",
            return_value=PrivateAgentDecision(route="chat"),
        ):
            res = client.post(
                f"/api/chat/sessions/{session_id}/messages",
                json={"content": "Hello world!"},
                cookies=auth_headers,
            )
        assert res.status_code == 200

        # Query messages from db and check tokens_used
        from app.models.chat import ChatMessage
        from sqlalchemy import select
        messages = db.scalars(select(ChatMessage).where(ChatMessage.session_id == session_id)).all()
        assert len(messages) == 2
        user_msg = next(m for m in messages if m.role == "user")
        assistant_msg = next(m for m in messages if m.role == "assistant")

        assert user_msg.tokens_used > 0
        assert user_msg.tokens_used == 4

        assert assistant_msg.tokens_used > 0
        assert assistant_msg.tokens_used == 1


def test_chat_stream_emits_action_receipt(client, auth_headers, monkeypatch):
    created = client.post(
        "/api/chat/sessions",
        json={"title": "Action Test", "model": "qwen"},
        cookies=auth_headers,
    )
    session_id = created.json()["id"]

    monkeypatch.setattr(
        "app.routers.chat.route_private_agent",
        lambda *_, **__: PrivateAgentDecision(route="execute", context="ledger"),
    )
    monkeypatch.setattr(
        "app.routers.chat.interpret_and_execute",
        lambda *_, **__: InterpretActionResponse(
            text="已记录午饭支出 28 元。",
            actions=[
                ActionReceipt(
                    action_id=123,
                    tool="create_ledger_entry",
                    status="succeeded",
                    result={"amount": "28.00"},
                    target_type="ledger_entry",
                    target_id=9,
                    can_undo=True,
                    created_at=datetime(2026, 8, 19, 12, 0),
                )
            ],
        ),
    )

    response = client.post(
        f"/api/chat/sessions/{session_id}/messages",
        json={"content": "午饭花了 28 元"},
        cookies=auth_headers,
    )

    assert response.status_code == 200
    assert '"type": "action_succeeded"' in response.text
    assert '"tool": "create_ledger_entry"' in response.text
    assert "已记录午饭支出" in response.text


def test_chat_stream_clarifies_without_executing(client, auth_headers, monkeypatch):
    created = client.post(
        "/api/chat/sessions",
        json={"title": "Clarify Test", "model": "qwen"},
        cookies=auth_headers,
    )
    session_id = created.json()["id"]
    monkeypatch.setattr(
        "app.routers.chat.route_private_agent",
        lambda *_, **__: PrivateAgentDecision(
            route="clarify", question="这笔金额是多少？"
        ),
    )
    execute = MagicMock()
    monkeypatch.setattr("app.routers.chat.interpret_and_execute", execute)

    response = client.post(
        f"/api/chat/sessions/{session_id}/messages",
        json={"content": "帮我记一笔"},
        cookies=auth_headers,
    )

    assert response.status_code == 200
    assert "这笔金额是多少" in response.text
    assert '"type": "done"' in response.text
    execute.assert_not_called()


def test_chat_blog_generation_emits_proposal_without_writing_post(
    client, user_cookies_factory, db, monkeypatch
):
    writer, cookies = user_cookies_factory("chat-blog-proposal")
    writer.can_write_blog = True
    db.commit()
    created = client.post(
        "/api/chat/sessions",
        json={"title": "Blog Proposal", "model": "qwen"},
        cookies=cookies,
    )
    session_id = created.json()["id"]
    monkeypatch.setattr(
        "app.routers.chat.route_private_agent",
        lambda *_, **__: PrivateAgentDecision(
            route="propose_blog",
            context="blog",
            proposal={"title": "Agent", "content": "完整正文"},
        ),
    )

    response = client.post(
        f"/api/chat/sessions/{session_id}/messages",
        json={"content": "写一篇关于 Agent 的博客"},
        cookies=cookies,
    )

    assert response.status_code == 200
    assert '"type": "action_proposed"' in response.text
    assert '"title": "Agent"' in response.text
    assert db.scalar(select(func.count(BlogPost.id))) == 0


def test_chat_can_confirm_pending_blog_proposal(
    client, user_cookies_factory, db, monkeypatch
):
    writer, cookies = user_cookies_factory("chat-blog-confirm")
    writer.can_write_blog = True
    db.commit()
    created = client.post(
        "/api/chat/sessions",
        json={"title": "Blog Confirm", "model": "qwen"},
        cookies=cookies,
    )
    session_id = created.json()["id"]
    confirm = MagicMock(
        return_value=ActionReceipt(
            action_id=88,
            tool="create_blog_post",
            status="succeeded",
            result={"title": "确认保存"},
            target_type="blog_post",
            target_id=9,
            can_undo=True,
            created_at=datetime(2026, 8, 19, 12, 0),
        )
    )
    monkeypatch.setattr("app.routers.chat.action_proposals.confirm_proposal", confirm)
    monkeypatch.setattr(
        "app.routers.chat.route_private_agent",
        lambda *_, **__: PrivateAgentDecision(
            route="confirm_proposal", proposal_id=77
        ),
    )

    response = client.post(
        f"/api/chat/sessions/{session_id}/messages",
        json={"content": "同意保存"},
        cookies=cookies,
    )

    assert response.status_code == 200
    assert '"type": "action_succeeded"' in response.text
    confirm.assert_called_once()
