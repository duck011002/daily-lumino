import hashlib

import pytest

from app.mcp_lumino import (
    MCPLuminoIdentity,
    create_ledger_entry,
    create_todo,
    create_blog_post,
    update_blog_post,
    publish_blog_post,
    update_library_profile,
    search_library_media_cards,
    upsert_library_media_card,
    current_mcp_lumino_identity,
    list_ledger_entries,
    resolve_mcp_lumino_identity,
)
from app.models.mcp_lumino_token import MCPLuminoToken


class SessionContext:
    def __init__(self, db):
        self.db = db

    def __enter__(self):
        return self.db

    def __exit__(self, *_):
        return False


def test_lumino_token_resolves_bound_user_and_scopes(db, user_factory):
    root = user_factory("lumino-token-root", is_root=True)
    owner = user_factory("lumino-token-owner")
    owner.can_use_mcp = True
    raw = "test-lumino-token"
    credential = MCPLuminoToken(
        label="test",
        token_hash=hashlib.sha256(raw.encode("utf-8")).hexdigest(),
        user_id=owner.id,
        created_by=root.id,
        scopes=["ledger:read", "ledger:write"],
    )
    db.add(credential)
    db.commit()

    identity = resolve_mcp_lumino_identity(db, raw, record_usage=False)

    assert identity is not None
    assert identity.user_id == owner.id
    assert identity.scopes == frozenset({"ledger:read", "ledger:write"})
    assert resolve_mcp_lumino_identity(db, "wrong", record_usage=False) is None


def test_lumino_tools_are_scoped_and_user_private(db, user_factory, monkeypatch):
    owner = user_factory("lumino-tools-owner")
    stranger = user_factory("lumino-tools-stranger")
    monkeypatch.setattr("app.mcp_lumino.SessionLocal", lambda: SessionContext(db))
    identity_token = current_mcp_lumino_identity.set(
        MCPLuminoIdentity(
            user_id=owner.id,
            scopes=frozenset(
                {"ledger:read", "ledger:write", "todos:read", "todos:write"}
            ),
            allow_auto_publish=False,
        )
    )
    try:
        ledger_result = create_ledger_entry(
            entry_type="expense",
            amount="32.50",
            category_name="餐饮",
            note="晚饭",
            idempotency_key="mcp-ledger-1",
        )
        todo_result = create_todo(
            title="核对账本",
            priority="high",
            idempotency_key="mcp-todo-1",
        )
        assert ledger_result["status"] == "succeeded"
        assert todo_result["status"] == "succeeded"
        assert len(list_ledger_entries(year=2025, month=8)) == 0

        owner_entries = list_ledger_entries()
        assert len(owner_entries) == 1
        assert owner_entries[0]["user_id"] == owner.id
        assert owner_entries[0]["user_id"] != stranger.id
    finally:
        current_mcp_lumino_identity.reset(identity_token)


def test_lumino_tool_rejects_missing_scope(db, user_factory, monkeypatch):
    owner = user_factory("lumino-scope-owner")
    monkeypatch.setattr("app.mcp_lumino.SessionLocal", lambda: SessionContext(db))
    identity_token = current_mcp_lumino_identity.set(
        MCPLuminoIdentity(
            user_id=owner.id,
            scopes=frozenset({"ledger:read"}),
            allow_auto_publish=False,
        )
    )
    try:
        with pytest.raises(ValueError, match="scope"):
            create_todo(title="不应创建", idempotency_key="mcp-denied")
    finally:
        current_mcp_lumino_identity.reset(identity_token)


def test_root_can_issue_user_bound_lumino_token(client, user_cookies_factory):
    _, root_cookies = user_cookies_factory("lumino-admin-root", is_root=True)
    owner, _ = user_cookies_factory("lumino-admin-owner")
    owner.can_use_mcp = True

    created = client.post(
        "/api/admin/mcp-lumino/tokens",
        cookies=root_cookies,
        json={
            "label": "Codex",
            "user_id": owner.id,
            "scopes": ["ledger:read", "ledger:write", "todos:write"],
        },
    )

    assert created.status_code == 201
    body = created.json()
    assert body["user_id"] == owner.id
    assert body["token"].startswith("lmu_mcp_")
    listed = client.get("/api/admin/mcp-lumino/tokens", cookies=root_cookies)
    assert listed.status_code == 200
    assert "token" not in listed.json()[0]


def test_lumino_token_scopes_must_match_bound_user_permissions(
    client, user_cookies_factory
):
    _, root_cookies = user_cookies_factory("lumino-scope-admin", is_root=True)
    owner, _ = user_cookies_factory("lumino-scope-user")
    owner.can_use_mcp = True

    blog_response = client.post(
        "/api/admin/mcp-lumino/tokens",
        cookies=root_cookies,
        json={
            "label": "Blog denied",
            "user_id": owner.id,
            "scopes": ["blog:write"],
        },
    )
    library_response = client.post(
        "/api/admin/mcp-lumino/tokens",
        cookies=root_cookies,
        json={
            "label": "Library denied",
            "user_id": owner.id,
            "scopes": ["library:read"],
        },
    )

    assert blog_response.status_code == 400
    assert "博客" in blog_response.json()["detail"]
    assert library_response.status_code == 400
    assert "Library" in library_response.json()["detail"]


def test_unified_mcp_blog_update_preserves_draft_and_library_is_root_only(
    db, user_factory, monkeypatch
):
    root = user_factory("lumino-all-root", is_root=True)
    monkeypatch.setattr("app.mcp_lumino.SessionLocal", lambda: SessionContext(db))
    identity_token = current_mcp_lumino_identity.set(
        MCPLuminoIdentity(
            user_id=root.id,
            scopes=frozenset(
                {"blog:read", "blog:write", "blog:publish", "library:write"}
            ),
            allow_auto_publish=False,
        )
    )
    try:
        created = create_blog_post(
            title="统一 MCP 草稿",
            content="old",
            idempotency_key="all-blog-create",
        )
        post_id = created["target_id"]
        updated = update_blog_post(
            post_id=post_id,
            content="new",
            idempotency_key="all-blog-update",
        )
        assert updated["result"]["is_published"] is False
        with pytest.raises(ValueError, match="Auto-publish"):
            publish_blog_post(post_id, idempotency_key="all-blog-publish")

        library = update_library_profile(
            headline="MCP 更新的 Library",
            idempotency_key="all-library-update",
        )
        assert library["result"]["headline"] == "MCP 更新的 Library"
    finally:
        current_mcp_lumino_identity.reset(identity_token)


def test_unified_mcp_searches_library_before_add(db, user_factory, monkeypatch):
    root = user_factory("lumino-library-search", is_root=True)
    monkeypatch.setattr("app.mcp_lumino.SessionLocal", lambda: SessionContext(db))
    token = current_mcp_lumino_identity.set(
        MCPLuminoIdentity(
            user_id=root.id,
            scopes=frozenset({"library:read", "library:write"}),
            allow_auto_publish=False,
        )
    )
    try:
        upsert_library_media_card(
            title="Harness",
            category="book",
            creator="Someone",
            idempotency_key="library-harness",
        )
        matches = search_library_media_cards("harness")
        assert len(matches) == 1
        assert matches[0]["title"] == "Harness"
    finally:
        current_mcp_lumino_identity.reset(token)
