from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable

from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.ai_action import AIActionRun
from app.models.ledger import LedgerEntry
from app.models.todo import Todo
from app.models.user import User
from app.schemas.actions import ActionReceipt, ActionRequest, EntryIdArguments, TodoIdArguments
from app.schemas.ledger import LedgerEntryCreate, LedgerEntryOut, LedgerEntryUpdate
from app.schemas.todo import TodoCreate, TodoOut, TodoUpdate
from app.services import ledger as ledger_service
from app.services import todos as todo_service


class ActionError(ValueError):
    pass


class ActionNotFoundError(ActionError):
    pass


class ActionPermissionError(ActionError):
    pass


class ActionValidationError(ActionError):
    pass


class ActionConflictError(ActionError):
    pass


class ActionUndoError(ActionError):
    pass


class UpdateLedgerArguments(LedgerEntryUpdate):
    entry_id: int


class UpdateTodoArguments(TodoUpdate):
    todo_id: int


@dataclass(frozen=True)
class ActionMutation:
    target_type: str
    target_id: int
    result: dict[str, Any]
    before: dict[str, Any] | None = None


@dataclass(frozen=True)
class ActionTool:
    name: str
    required_scope: str
    argument_model: type[BaseModel]
    execute: Callable[[Session, User, BaseModel, str], ActionMutation]
    undo: Callable[[Session, User, AIActionRun], dict[str, Any]]


def _ledger_snapshot(entry: LedgerEntry) -> dict[str, Any]:
    return jsonable_encoder(
        {
            "entry_type": entry.entry_type,
            "amount": entry.amount,
            "category_id": entry.category_id,
            "occurred_at": entry.occurred_at,
            "note": entry.note,
        }
    )


def _todo_snapshot(todo: Todo) -> dict[str, Any]:
    return jsonable_encoder(
        {
            "id": todo.id,
            "title": todo.title,
            "description": todo.description,
            "priority": todo.priority,
            "status": todo.status,
            "due_at": todo.due_at,
            "remind_at": todo.remind_at,
            "is_reminded": todo.is_reminded,
            "source_url": todo.source_url,
        }
    )


def _create_ledger(
    db: Session, user: User, arguments: BaseModel, action_key: str
) -> ActionMutation:
    payload = LedgerEntryCreate.model_validate(arguments.model_dump())
    payload.idempotency_key = f"action:{user.id}:{action_key}"
    entry = ledger_service.create_entry(
        db, user, payload, source="ai_action", commit=False
    )
    result = LedgerEntryOut.model_validate(entry).model_dump(mode="json")
    return ActionMutation("ledger_entry", entry.id, result)


def _update_ledger(
    db: Session, user: User, arguments: BaseModel, action_key: str
) -> ActionMutation:
    entry_id = getattr(arguments, "entry_id")
    entry = ledger_service.get_entry(db, user, entry_id)
    before = _ledger_snapshot(entry)
    update = LedgerEntryUpdate.model_validate(
        arguments.model_dump(exclude={"entry_id"}, exclude_unset=True)
    )
    entry = ledger_service.update_entry(db, user, entry_id, update, commit=False)
    return ActionMutation(
        "ledger_entry",
        entry.id,
        LedgerEntryOut.model_validate(entry).model_dump(mode="json"),
        before,
    )


def _delete_ledger(
    db: Session, user: User, arguments: BaseModel, action_key: str
) -> ActionMutation:
    payload = EntryIdArguments.model_validate(arguments.model_dump())
    entry = ledger_service.get_entry(db, user, payload.entry_id)
    before = _ledger_snapshot(entry)
    entry = ledger_service.soft_delete_entry(db, user, entry.id, commit=False)
    return ActionMutation(
        "ledger_entry",
        entry.id,
        LedgerEntryOut.model_validate(entry).model_dump(mode="json"),
        before,
    )


def _create_todo(
    db: Session, user: User, arguments: BaseModel, action_key: str
) -> ActionMutation:
    payload = TodoCreate.model_validate(arguments.model_dump())
    todo = todo_service.create_todo(db, user, payload, commit=False)
    return ActionMutation(
        "todo", todo.id, TodoOut.model_validate(todo).model_dump(mode="json")
    )


def _update_todo(
    db: Session, user: User, arguments: BaseModel, action_key: str
) -> ActionMutation:
    todo_id = getattr(arguments, "todo_id")
    todo = todo_service.get_owned_todo(db, user, todo_id)
    before = _todo_snapshot(todo)
    update = TodoUpdate.model_validate(
        arguments.model_dump(exclude={"todo_id"}, exclude_unset=True)
    )
    todo = todo_service.update_todo(db, user, todo.id, update, commit=False)
    return ActionMutation(
        "todo",
        todo.id,
        TodoOut.model_validate(todo).model_dump(mode="json"),
        before,
    )


def _delete_todo(
    db: Session, user: User, arguments: BaseModel, action_key: str
) -> ActionMutation:
    payload = TodoIdArguments.model_validate(arguments.model_dump())
    todo = todo_service.get_owned_todo(db, user, payload.todo_id)
    before = _todo_snapshot(todo)
    target_id = todo.id
    todo_service.delete_todo(db, user, target_id, commit=False)
    return ActionMutation("todo", target_id, {"deleted": True}, before)


def _undo_created_ledger(db: Session, user: User, run: AIActionRun) -> dict[str, Any]:
    entry = ledger_service.soft_delete_entry(db, user, run.target_id or 0, commit=False)
    return {"deleted_entry_id": entry.id}


def _undo_updated_ledger(db: Session, user: User, run: AIActionRun) -> dict[str, Any]:
    if not run.before_json or run.target_id is None:
        raise ActionUndoError("该行动缺少可撤销快照。")
    entry = ledger_service.update_entry(
        db,
        user,
        run.target_id,
        LedgerEntryUpdate.model_validate(run.before_json),
        commit=False,
    )
    return LedgerEntryOut.model_validate(entry).model_dump(mode="json")


def _undo_deleted_ledger(db: Session, user: User, run: AIActionRun) -> dict[str, Any]:
    entry = ledger_service.restore_entry(db, user, run.target_id or 0, commit=False)
    return {"restored_entry_id": entry.id}


def _undo_created_todo(db: Session, user: User, run: AIActionRun) -> dict[str, Any]:
    target_id = run.target_id or 0
    todo_service.delete_todo(db, user, target_id, commit=False)
    return {"deleted_todo_id": target_id}


def _undo_updated_todo(db: Session, user: User, run: AIActionRun) -> dict[str, Any]:
    if not run.before_json or run.target_id is None:
        raise ActionUndoError("该行动缺少可撤销快照。")
    before = dict(run.before_json)
    before.pop("id", None)
    todo = todo_service.update_todo(
        db,
        user,
        run.target_id,
        TodoUpdate.model_validate(before),
        commit=False,
    )
    return TodoOut.model_validate(todo).model_dump(mode="json")


def _undo_deleted_todo(db: Session, user: User, run: AIActionRun) -> dict[str, Any]:
    if not run.before_json:
        raise ActionUndoError("该行动缺少可撤销快照。")
    before = dict(run.before_json)
    restored_payload = TodoCreate.model_validate(
        {
            key: value
            for key, value in before.items()
            if key
            in {
                "title",
                "description",
                "priority",
                "status",
                "due_at",
                "remind_at",
                "source_url",
            }
        }
    )
    restored = Todo(
        id=before["id"],
        user_id=user.id,
        title=restored_payload.title,
        description=restored_payload.description,
        priority=restored_payload.priority,
        status=restored_payload.status,
        due_at=restored_payload.due_at,
        remind_at=restored_payload.remind_at,
        is_reminded=before.get("is_reminded", False),
        source_url=restored_payload.source_url,
    )
    db.add(restored)
    db.flush()
    return TodoOut.model_validate(restored).model_dump(mode="json")


TOOLS: dict[str, ActionTool] = {
    "create_ledger_entry": ActionTool(
        "create_ledger_entry", "ledger:write", LedgerEntryCreate, _create_ledger, _undo_created_ledger
    ),
    "update_ledger_entry": ActionTool(
        "update_ledger_entry", "ledger:write", UpdateLedgerArguments, _update_ledger, _undo_updated_ledger
    ),
    "delete_ledger_entry": ActionTool(
        "delete_ledger_entry", "ledger:write", EntryIdArguments, _delete_ledger, _undo_deleted_ledger
    ),
    "create_todo": ActionTool(
        "create_todo", "todos:write", TodoCreate, _create_todo, _undo_created_todo
    ),
    "update_todo": ActionTool(
        "update_todo", "todos:write", UpdateTodoArguments, _update_todo, _undo_updated_todo
    ),
    "delete_todo": ActionTool(
        "delete_todo", "todos:write", TodoIdArguments, _delete_todo, _undo_deleted_todo
    ),
}


def execute_action(
    db: Session,
    user: User,
    request: ActionRequest,
    *,
    source: str,
    allowed_scopes: set[str] | None = None,
) -> ActionReceipt:
    tool = TOOLS.get(request.tool)
    if not tool:
        raise ActionNotFoundError("未知行动工具。")
    if allowed_scopes is not None and tool.required_scope not in allowed_scopes:
        raise ActionPermissionError("当前凭证没有执行该行动的权限。")

    existing = db.scalar(
        select(AIActionRun).where(
            AIActionRun.user_id == user.id,
            AIActionRun.idempotency_key == request.idempotency_key,
        )
    )
    if existing:
        if existing.tool_name != request.tool or existing.request_json != request.arguments:
            raise ActionConflictError("该幂等键已用于其他行动。")
        return _receipt(existing)

    try:
        arguments = tool.argument_model.model_validate(request.arguments)
    except ValidationError as exc:
        raise ActionValidationError(str(exc)) from exc

    user_id = user.id
    run = AIActionRun(
        user_id=user_id,
        source=source,
        tool_name=tool.name,
        idempotency_key=request.idempotency_key,
        request_json=jsonable_encoder(request.arguments),
        status="running",
    )
    savepoint = db.begin_nested()
    db.add(run)
    try:
        mutation = tool.execute(db, user, arguments, request.idempotency_key)
        run.result_json = mutation.result
        run.before_json = mutation.before
        run.target_type = mutation.target_type
        run.target_id = mutation.target_id
        run.status = "succeeded"
        savepoint.commit()
        db.commit()
        db.refresh(run)
    except Exception as exc:
        savepoint.rollback()
        failed = AIActionRun(
            user_id=user_id,
            source=source,
            tool_name=tool.name,
            idempotency_key=request.idempotency_key,
            request_json=jsonable_encoder(request.arguments),
            status="failed",
            error_code=type(exc).__name__,
            error_message=str(exc)[:2000],
        )
        db.add(failed)
        db.commit()
        if isinstance(exc, ActionError):
            raise
        raise ActionValidationError(str(exc)) from exc
    return _receipt(run)


def undo_action(
    db: Session,
    user: User,
    action_id: int,
    *,
    allowed_scopes: set[str] | None = None,
) -> ActionReceipt:
    run = db.get(AIActionRun, action_id)
    if not run:
        raise ActionNotFoundError("行动记录不存在。")
    if run.user_id != user.id:
        raise ActionPermissionError("不能撤销其他用户的行动。")
    tool = TOOLS.get(run.tool_name)
    if not tool:
        raise ActionUndoError("该行动不支持撤销。")
    if allowed_scopes is not None and tool.required_scope not in allowed_scopes:
        raise ActionPermissionError("当前凭证没有撤销该行动的权限。")
    if run.status != "succeeded" or run.undone_at is not None:
        raise ActionUndoError("该行动已撤销或当前状态不可撤销。")

    result = tool.undo(db, user, run)
    run.status = "undone"
    run.undone_at = datetime.now(timezone.utc).replace(tzinfo=None)
    run.result_json = {"original": run.result_json, "undo": result}
    db.commit()
    db.refresh(run)
    return _receipt(run)


def _receipt(run: AIActionRun) -> ActionReceipt:
    return ActionReceipt(
        action_id=run.id,
        tool=run.tool_name,
        status=run.status,
        result=run.result_json,
        target_type=run.target_type,
        target_id=run.target_id,
        can_undo=run.status == "succeeded" and run.undone_at is None,
        created_at=run.created_at,
    )
