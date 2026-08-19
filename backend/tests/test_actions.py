from sqlalchemy import func, select

from app.models.ai_action import AIActionRun
from app.models.ledger import LedgerEntry
from app.models.todo import Todo
from app.schemas.actions import ActionRequest
from app.services.action_executor import (
    ActionPermissionError,
    ActionUndoError,
    execute_action,
    undo_action,
)


def test_action_executor_is_idempotent_and_undoes_ledger_create(db, user_factory):
    user = user_factory("actions-ledger")
    request = ActionRequest(
        tool="create_ledger_entry",
        arguments={
            "entry_type": "expense",
            "amount": "18",
            "category_name": "餐饮",
        },
        idempotency_key="action-ledger-1",
    )

    first = execute_action(db, user, request, source="web_ai")
    second = execute_action(db, user, request, source="web_ai")

    assert first.action_id == second.action_id
    assert db.scalar(select(func.count(LedgerEntry.id))) == 1
    assert db.scalar(select(func.count(AIActionRun.id))) == 1

    undone = undo_action(db, user, first.action_id)
    entry = db.get(LedgerEntry, first.target_id)
    assert undone.status == "undone"
    assert entry is not None and entry.deleted_at is not None

    try:
        undo_action(db, user, first.action_id)
    except ActionUndoError:
        pass
    else:
        raise AssertionError("同一行动不能重复撤销")


def test_action_executor_creates_and_undoes_todo(db, user_factory):
    user = user_factory("actions-todo")
    result = execute_action(
        db,
        user,
        ActionRequest(
            tool="create_todo",
            arguments={"title": "整理账本", "priority": "high"},
            idempotency_key="action-todo-1",
        ),
        source="mcp",
        allowed_scopes={"todos:write"},
    )

    assert result.status == "succeeded"
    assert db.get(Todo, result.target_id) is not None
    assert undo_action(db, user, result.action_id).status == "undone"
    assert db.get(Todo, result.target_id) is None


def test_action_scope_and_owner_are_enforced(db, user_factory):
    owner = user_factory("actions-owner")
    stranger = user_factory("actions-stranger")
    request = ActionRequest(
        tool="create_ledger_entry",
        arguments={
            "entry_type": "expense",
            "amount": "8",
            "category_name": "交通",
        },
        idempotency_key="action-owner-1",
    )

    try:
        execute_action(
            db,
            owner,
            request,
            source="mcp",
            allowed_scopes={"todos:write"},
        )
    except ActionPermissionError:
        pass
    else:
        raise AssertionError("缺少 ledger:write 时不能记账")

    result = execute_action(db, owner, request, source="web_ai")
    try:
        undo_action(db, stranger, result.action_id)
    except ActionPermissionError:
        pass
    else:
        raise AssertionError("其他用户不能撤销该行动")


def test_action_rest_api_executes_and_undoes(client, user_cookies_factory):
    _, cookies = user_cookies_factory("actions-api")
    created = client.post(
        "/api/ai/actions/execute",
        cookies=cookies,
        json={
            "tool": "create_todo",
            "arguments": {"title": "测试网页行动"},
            "idempotency_key": "actions-api-1",
        },
    )
    assert created.status_code == 200
    action_id = created.json()["action_id"]
    assert created.json()["can_undo"] is True

    undone = client.post(
        f"/api/ai/actions/{action_id}/undo",
        cookies=cookies,
    )
    assert undone.status_code == 200
    assert undone.json()["status"] == "undone"


def test_update_ledger_action_undo_restores_previous_values(db, user_factory):
    user = user_factory("actions-ledger-update")
    created = execute_action(
        db,
        user,
        ActionRequest(
            tool="create_ledger_entry",
            arguments={
                "entry_type": "expense",
                "amount": "10",
                "category_name": "餐饮",
            },
            idempotency_key="ledger-update-create",
        ),
        source="web_ai",
    )
    updated = execute_action(
        db,
        user,
        ActionRequest(
            tool="update_ledger_entry",
            arguments={"entry_id": created.target_id, "amount": "25"},
            idempotency_key="ledger-update-change",
        ),
        source="web_ai",
    )
    assert db.get(LedgerEntry, created.target_id).amount == 25

    undo_action(db, user, updated.action_id)
    restored = db.get(LedgerEntry, created.target_id)
    db.refresh(restored)
    assert restored.amount == 10


def test_delete_todo_action_undo_restores_datetime_and_id(db, user_factory):
    user = user_factory("actions-todo-delete")
    created = execute_action(
        db,
        user,
        ActionRequest(
            tool="create_todo",
            arguments={
                "title": "按时提交",
                "due_at": "2026-08-20T09:30:00",
            },
            idempotency_key="todo-delete-create",
        ),
        source="web_ai",
    )
    deleted = execute_action(
        db,
        user,
        ActionRequest(
            tool="delete_todo",
            arguments={"todo_id": created.target_id},
            idempotency_key="todo-delete-action",
        ),
        source="web_ai",
    )
    assert db.get(Todo, created.target_id) is None

    undo_action(db, user, deleted.action_id)
    restored = db.get(Todo, created.target_id)
    assert restored is not None
    assert restored.due_at.isoformat() == "2026-08-20T09:30:00"
