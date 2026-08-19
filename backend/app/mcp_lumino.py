"""User-bound, scope-limited MCP tools for Lumino personal modules."""

import hashlib
import uuid
from contextvars import ContextVar
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Literal

from mcp.server.fastmcp import FastMCP
from sqlalchemy import select
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from app.database import SessionLocal
from app.models.mcp_lumino_token import MCPLuminoToken
from app.models.user import User
from app.schemas.actions import ActionRequest
from app.schemas.ledger import LedgerCategoryOut, LedgerEntryOut
from app.schemas.todo import TodoOut
from app.services import action_executor, ledger as ledger_service, todos as todo_service


lumino_mcp = FastMCP(
    "Lumino",
    instructions=(
        "Manage the authenticated Lumino user's private ledger and todos. "
        "Read existing data before ambiguous updates, use stable idempotency keys for writes, "
        "and return action_id so the user can undo a change."
    ),
    stateless_http=True,
    json_response=True,
    streamable_http_path="/",
)


@dataclass(frozen=True)
class MCPLuminoIdentity:
    user_id: int
    scopes: frozenset[str]
    allow_auto_publish: bool


current_mcp_lumino_identity: ContextVar[MCPLuminoIdentity | None] = ContextVar(
    "current_mcp_lumino_identity", default=None
)


def hash_mcp_lumino_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def resolve_mcp_lumino_identity(
    db, token: str, *, record_usage: bool = True
) -> MCPLuminoIdentity | None:
    if not token:
        return None
    credential = db.scalar(
        select(MCPLuminoToken).where(
            MCPLuminoToken.token_hash == hash_mcp_lumino_token(token),
            MCPLuminoToken.is_active.is_(True),
        )
    )
    if not credential:
        return None
    user = db.get(User, credential.user_id)
    if not user or not user.is_active or (not user.is_root and not user.can_use_mcp):
        return None
    if record_usage:
        credential.last_used_at = datetime.now(UTC).replace(tzinfo=None)
        db.commit()
    return MCPLuminoIdentity(
        user_id=user.id,
        scopes=frozenset(credential.scopes),
        allow_auto_publish=credential.allow_auto_publish,
    )


def _identity() -> MCPLuminoIdentity:
    identity = current_mcp_lumino_identity.get()
    if not identity:
        raise ValueError("Lumino MCP credential was not resolved.")
    return identity


def _require_scope(identity: MCPLuminoIdentity, scope: str) -> None:
    if scope not in identity.scopes:
        raise ValueError(f"This MCP token is missing the required scope: {scope}")


def _user(db, identity: MCPLuminoIdentity) -> User:
    user = db.get(User, identity.user_id)
    if not user or not user.is_active:
        raise ValueError("The user bound to this MCP token is unavailable.")
    return user


def _execute(tool: str, arguments: dict[str, Any], idempotency_key: str | None):
    identity = _identity()
    with SessionLocal() as db:
        user = _user(db, identity)
        receipt = action_executor.execute_action(
            db,
            user,
            ActionRequest(
                tool=tool,
                arguments=arguments,
                idempotency_key=idempotency_key or uuid.uuid4().hex,
            ),
            source="mcp",
            allowed_scopes=set(identity.scopes),
        )
        return receipt.model_dump(mode="json")


@lumino_mcp.tool(description="List this user's active ledger categories.")
def list_ledger_categories() -> list[dict[str, Any]]:
    identity = _identity()
    _require_scope(identity, "ledger:read")
    with SessionLocal() as db:
        user = _user(db, identity)
        return [
            LedgerCategoryOut.model_validate(item).model_dump(mode="json")
            for item in ledger_service.list_categories(db, user)
        ]


@lumino_mcp.tool(description="List this user's ledger entries, optionally for one month.")
def list_ledger_entries(
    year: int | None = None, month: int | None = None
) -> list[dict[str, Any]]:
    identity = _identity()
    _require_scope(identity, "ledger:read")
    if (year is None) != (month is None):
        raise ValueError("year and month must be provided together.")
    with SessionLocal() as db:
        user = _user(db, identity)
        return [
            LedgerEntryOut.model_validate(item).model_dump(mode="json")
            for item in ledger_service.list_entries(db, user, year=year, month=month)
        ]


@lumino_mcp.tool(description="Get this user's ledger totals for one month.")
def get_ledger_month_summary(year: int, month: int) -> dict[str, Any]:
    identity = _identity()
    _require_scope(identity, "ledger:read")
    with SessionLocal() as db:
        user = _user(db, identity)
        return ledger_service.get_month_summary(db, user, year, month).model_dump(mode="json")


@lumino_mcp.tool(
    description="Create one private income or expense entry and return an undoable action receipt."
)
def create_ledger_entry(
    entry_type: Literal["expense", "income"],
    amount: str,
    category_id: int | None = None,
    category_name: str | None = None,
    occurred_at: datetime | None = None,
    note: str | None = None,
    idempotency_key: str | None = None,
) -> dict[str, Any]:
    identity = _identity()
    _require_scope(identity, "ledger:write")
    arguments = {
        "entry_type": entry_type,
        "amount": amount,
        "category_id": category_id,
        "category_name": category_name,
        "occurred_at": occurred_at,
        "note": note,
    }
    return _execute(
        "create_ledger_entry",
        {key: value for key, value in arguments.items() if value is not None},
        idempotency_key,
    )


@lumino_mcp.tool(description="Update one private ledger entry and return an undoable receipt.")
def update_ledger_entry(
    entry_id: int,
    entry_type: Literal["expense", "income"] | None = None,
    amount: str | None = None,
    category_id: int | None = None,
    category_name: str | None = None,
    occurred_at: datetime | None = None,
    note: str | None = None,
    idempotency_key: str | None = None,
) -> dict[str, Any]:
    identity = _identity()
    _require_scope(identity, "ledger:write")
    arguments = {
        "entry_id": entry_id,
        "entry_type": entry_type,
        "amount": amount,
        "category_id": category_id,
        "category_name": category_name,
        "occurred_at": occurred_at,
        "note": note,
    }
    return _execute(
        "update_ledger_entry",
        {key: value for key, value in arguments.items() if value is not None},
        idempotency_key,
    )


@lumino_mcp.tool(description="Delete one private ledger entry and return an undoable receipt.")
def delete_ledger_entry(
    entry_id: int, idempotency_key: str | None = None
) -> dict[str, Any]:
    identity = _identity()
    _require_scope(identity, "ledger:write")
    return _execute(
        "delete_ledger_entry", {"entry_id": entry_id}, idempotency_key
    )


@lumino_mcp.tool(description="List this user's private todos.")
def list_todos(
    status_filter: Literal["pending", "completed", "cancelled"] | None = None,
) -> list[dict[str, Any]]:
    identity = _identity()
    _require_scope(identity, "todos:read")
    with SessionLocal() as db:
        user = _user(db, identity)
        return [
            TodoOut.model_validate(item).model_dump(mode="json")
            for item in todo_service.list_todos(
                db, user, status_filter=status_filter
            )
        ]


@lumino_mcp.tool(description="Create one private todo and return an undoable action receipt.")
def create_todo(
    title: str,
    description: str | None = None,
    priority: Literal["low", "medium", "high"] = "medium",
    due_at: datetime | None = None,
    remind_at: datetime | None = None,
    source_url: str | None = None,
    idempotency_key: str | None = None,
) -> dict[str, Any]:
    identity = _identity()
    _require_scope(identity, "todos:write")
    arguments = {
        "title": title,
        "description": description,
        "priority": priority,
        "due_at": due_at,
        "remind_at": remind_at,
        "source_url": source_url,
    }
    return _execute(
        "create_todo",
        {key: value for key, value in arguments.items() if value is not None},
        idempotency_key,
    )


@lumino_mcp.tool(description="Update one private todo and return an undoable action receipt.")
def update_todo(
    todo_id: int,
    title: str | None = None,
    description: str | None = None,
    priority: Literal["low", "medium", "high"] | None = None,
    status: Literal["pending", "completed", "cancelled"] | None = None,
    due_at: datetime | None = None,
    remind_at: datetime | None = None,
    source_url: str | None = None,
    idempotency_key: str | None = None,
) -> dict[str, Any]:
    identity = _identity()
    _require_scope(identity, "todos:write")
    arguments = {
        "todo_id": todo_id,
        "title": title,
        "description": description,
        "priority": priority,
        "status": status,
        "due_at": due_at,
        "remind_at": remind_at,
        "source_url": source_url,
    }
    return _execute(
        "update_todo",
        {key: value for key, value in arguments.items() if value is not None},
        idempotency_key,
    )


@lumino_mcp.tool(description="Delete one private todo and return an undoable action receipt.")
def delete_todo(todo_id: int, idempotency_key: str | None = None) -> dict[str, Any]:
    identity = _identity()
    _require_scope(identity, "todos:write")
    return _execute("delete_todo", {"todo_id": todo_id}, idempotency_key)


@lumino_mcp.tool(description="Undo one successful action created by this user and token scope.")
def undo_action(action_id: int) -> dict[str, Any]:
    identity = _identity()
    with SessionLocal() as db:
        user = _user(db, identity)
        receipt = action_executor.undo_action(
            db,
            user,
            action_id,
            allowed_scopes=set(identity.scopes),
        )
        return receipt.model_dump(mode="json")


class MCPLuminoTokenMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        headers = {
            key.decode("latin-1").lower(): value.decode("latin-1")
            for key, value in scope["headers"]
        }
        token = headers.get("authorization", "").removeprefix("Bearer ").strip()
        with SessionLocal() as db:
            identity = resolve_mcp_lumino_identity(db, token)
        if not identity:
            response = JSONResponse(
                {"detail": "Invalid Lumino MCP token."},
                status_code=401,
                headers={"WWW-Authenticate": "Bearer"},
            )
            await response(scope, receive, send)
            return
        context_token = current_mcp_lumino_identity.set(identity)
        try:
            await self.app(scope, receive, send)
        finally:
            current_mcp_lumino_identity.reset(context_token)


lumino_mcp_asgi = MCPLuminoTokenMiddleware(lumino_mcp.streamable_http_app())
