import hashlib

import pytest

from app.mcp_lumino import (
    MCPLuminoIdentity,
    create_ledger_entry,
    create_todo,
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
