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
from app.mcp_compat import MCPDiscoveryFallbackMiddleware
from app.models.blog import BlogPost
from app.models.mcp_lumino_token import MCPLuminoToken
from app.models.user import User
from app.routers.site import load_site_profile
from app.schemas.actions import ActionRequest
from app.schemas.ledger import LedgerCategoryOut, LedgerEntryOut
from app.schemas.todo import TodoOut
from app.services import action_executor, blog_actions, library_actions
from app.services import ledger as ledger_service
from app.services import todos as todo_service

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


def _require_root(user: User) -> None:
    if not user.is_root:
        raise ValueError("Library MCP tools are restricted to the root user.")


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


@lumino_mcp.tool(
    description="List this user's ledger entries, optionally for one month."
)
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
        return ledger_service.get_month_summary(db, user, year, month).model_dump(
            mode="json"
        )


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


@lumino_mcp.tool(
    description="Update one private ledger entry and return an undoable receipt."
)
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


@lumino_mcp.tool(
    description="Delete one private ledger entry and return an undoable receipt."
)
def delete_ledger_entry(
    entry_id: int, idempotency_key: str | None = None
) -> dict[str, Any]:
    identity = _identity()
    _require_scope(identity, "ledger:write")
    return _execute("delete_ledger_entry", {"entry_id": entry_id}, idempotency_key)


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
            for item in todo_service.list_todos(db, user, status_filter=status_filter)
        ]


@lumino_mcp.tool(
    description="Create one private todo and return an undoable action receipt."
)
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


@lumino_mcp.tool(
    description="Update one private todo and return an undoable action receipt."
)
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


@lumino_mcp.tool(
    description="Delete one private todo and return an undoable action receipt."
)
def delete_todo(todo_id: int, idempotency_key: str | None = None) -> dict[str, Any]:
    identity = _identity()
    _require_scope(identity, "todos:write")
    return _execute("delete_todo", {"todo_id": todo_id}, idempotency_key)


@lumino_mcp.tool(
    description="Undo one successful action created by this user and token scope."
)
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


@lumino_mcp.tool(
    description="List blog posts owned by this MCP token's user, including drafts."
)
def list_blog_posts() -> list[dict[str, Any]]:
    identity = _identity()
    _require_scope(identity, "blog:read")
    with SessionLocal() as db:
        user = _user(db, identity)
        blog_actions.ensure_writer(user)
        stmt = (
            select(BlogPost)
            .where(BlogPost.deleted_at.is_(None))
            .order_by(BlogPost.created_at.desc())
        )
        if not user.is_root:
            stmt = stmt.where(BlogPost.author_id == user.id)
        return [blog_actions.serialize_post(post) for post in db.scalars(stmt).all()]


@lumino_mcp.tool(
    description=(
        "Create a blog post. Tokens with auto-publish and blog:publish publish it "
        "by default; other tokens safely create a private draft."
    )
)
def create_blog_post(
    title: str,
    content: str,
    slug: str | None = None,
    excerpt: str | None = None,
    cover_url: str | None = None,
    tags: list[str] | None = None,
    category_id: int | None = None,
    idempotency_key: str | None = None,
) -> dict[str, Any]:
    identity = _identity()
    _require_scope(identity, "blog:write")
    arguments = {
        "title": title,
        "content": content,
        "slug": slug,
        "excerpt": excerpt,
        "cover_url": cover_url,
        "tags": tags,
        "category_id": category_id,
    }
    created = _execute(
        "create_blog_post",
        {key: value for key, value in arguments.items() if value is not None},
        idempotency_key,
    )
    # Publishing is opt-in only when both the token flag and scope are present.
    # Keep a malformed or stale identity safe by returning the already-created
    # post as a private draft instead of leaving an orphaned write before the
    # scope check fails.
    if not identity.allow_auto_publish or "blog:publish" not in identity.scopes:
        created["notice"] = (
            "Auto-publish is disabled, so this post was created as a private draft."
        )
        return created
    _require_scope(identity, "blog:publish")
    published = _execute(
        "publish_blog_post",
        {"post_id": created["target_id"]},
        f"auto-publish:{created['action_id']}",
    )
    created["result"] = published["result"]
    created["publish_action_id"] = published["action_id"]
    return created


@lumino_mcp.tool(
    description="Update an owned blog post without changing public or published status."
)
def update_blog_post(
    post_id: int,
    title: str | None = None,
    content: str | None = None,
    slug: str | None = None,
    excerpt: str | None = None,
    cover_url: str | None = None,
    tags: list[str] | None = None,
    category_id: int | None = None,
    idempotency_key: str | None = None,
) -> dict[str, Any]:
    identity = _identity()
    _require_scope(identity, "blog:write")
    arguments = {
        "post_id": post_id,
        "title": title,
        "content": content,
        "slug": slug,
        "excerpt": excerpt,
        "cover_url": cover_url,
        "tags": tags,
        "category_id": category_id,
    }
    return _execute(
        "update_blog_post",
        {key: value for key, value in arguments.items() if value is not None},
        idempotency_key,
    )


@lumino_mcp.tool(
    description="Publish an owned blog draft after explicit user approval."
)
def publish_blog_post(
    post_id: int, idempotency_key: str | None = None
) -> dict[str, Any]:
    identity = _identity()
    _require_scope(identity, "blog:publish")
    if not identity.allow_auto_publish:
        raise ValueError("Auto-publish is disabled for this Lumino MCP token.")
    return _execute("publish_blog_post", {"post_id": post_id}, idempotency_key)


@lumino_mcp.tool(
    description="Read the complete root Library profile, including hidden items."
)
def get_library_profile() -> dict[str, Any]:
    identity = _identity()
    _require_scope(identity, "library:read")
    with SessionLocal() as db:
        user = _user(db, identity)
        _require_root(user)
        return load_site_profile(db).model_dump(mode="json")


@lumino_mcp.tool(description="Search root Library cards before adding or updating one.")
def search_library_media_cards(query: str) -> list[dict[str, Any]]:
    identity = _identity()
    _require_scope(identity, "library:read")
    with SessionLocal() as db:
        user = _user(db, identity)
        _require_root(user)
        return [
            item.model_dump(mode="json")
            for item in library_actions.search_media_cards(db, query)
        ]


@lumino_mcp.tool(description="Update selected root Library profile fields.")
def update_library_profile(
    display_name: str | None = None,
    headline: str | None = None,
    bio: str | None = None,
    interest_tags: list[str] | None = None,
    status_text: str | None = None,
    status_public: bool | None = None,
    idempotency_key: str | None = None,
) -> dict[str, Any]:
    identity = _identity()
    _require_scope(identity, "library:write")
    arguments = {
        "display_name": display_name,
        "headline": headline,
        "bio": bio,
        "interest_tags": interest_tags,
        "status_text": status_text,
        "status_public": status_public,
    }
    return _execute(
        "update_library_profile",
        {key: value for key, value in arguments.items() if value is not None},
        idempotency_key,
    )


@lumino_mcp.tool(description="Create or update one root Library collection card.")
def upsert_library_media_card(
    title: str,
    category: Literal["book", "movie", "music", "status", "other"] = "other",
    card_id: str | None = None,
    creator: str | None = None,
    note: str | None = None,
    image_url: str | None = None,
    url: str | None = None,
    is_public: bool = True,
    is_featured: bool = False,
    idempotency_key: str | None = None,
) -> dict[str, Any]:
    identity = _identity()
    _require_scope(identity, "library:write")
    arguments = {
        "title": title,
        "category": category,
        "card_id": card_id,
        "creator": creator,
        "note": note,
        "image_url": image_url,
        "url": url,
        "is_public": is_public,
        "is_featured": is_featured,
    }
    return _execute(
        "upsert_library_media_card",
        {key: value for key, value in arguments.items() if value is not None},
        idempotency_key,
    )


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


lumino_mcp_asgi = MCPLuminoTokenMiddleware(
    MCPDiscoveryFallbackMiddleware(lumino_mcp.streamable_http_app())
)
