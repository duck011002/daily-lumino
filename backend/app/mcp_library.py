"""MCP tools for directly maintaining Lumino's public library profile."""

import base64
import binascii
import hashlib
import uuid
from contextvars import ContextVar
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Literal

from fastapi import HTTPException
from mcp.server.fastmcp import FastMCP
from sqlalchemy import select
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from app.config import settings
from app.database import SessionLocal
from app.models.mcp_library_token import MCPLibraryToken
from app.models.user import User
from app.routers.site import load_site_profile, save_site_profile
from app.schemas.site import SiteMediaCard, SiteProfile, SiteProfileLink
from app.services import library_actions
from app.services.upload import upload_file_to_lsky


library_mcp = FastMCP(
    "Lumino Library",
    instructions=(
        "Maintain the owner's Lumino library. Changes are applied immediately. "
        "Respect is_public, show_email and status_public; never claim hidden content is public."
    ),
    stateless_http=True,
    json_response=True,
    streamable_http_path="/",
)


@dataclass(frozen=True)
class MCPLibraryIdentity:
    user_id: int


current_mcp_library_identity: ContextVar[MCPLibraryIdentity | None] = ContextVar(
    "current_mcp_library_identity", default=None
)


def hash_mcp_library_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def resolve_mcp_library_identity(db, token: str, *, record_usage: bool = True):
    if not token:
        return None
    credential = db.scalar(
        select(MCPLibraryToken).where(
            MCPLibraryToken.token_hash == hash_mcp_library_token(token),
            MCPLibraryToken.is_active.is_(True),
        )
    )
    if not credential:
        return None
    user = db.get(User, credential.created_by)
    if not user or not user.is_active or not user.is_root:
        return None
    if record_usage:
        credential.last_used_at = datetime.now(UTC).replace(tzinfo=None)
        db.commit()
    return MCPLibraryIdentity(user_id=user.id)


def _identity() -> MCPLibraryIdentity:
    identity = current_mcp_library_identity.get()
    if not identity:
        raise ValueError("MCP library credential was not resolved.")
    return identity


@library_mcp.tool(description="Read the complete library profile, including hidden items.")
def get_library_profile() -> dict[str, Any]:
    _identity()
    with SessionLocal() as db:
        return load_site_profile(db).model_dump(mode="json")


@library_mcp.tool(description="Update library profile fields. Changes take effect immediately.")
def update_library_profile(
    display_name: str | None = None,
    headline: str | None = None,
    bio: str | None = None,
    avatar_url: str | None = None,
    cover_url: str | None = None,
    interest_tags: list[str] | None = None,
    github_url: str | None = None,
    email: str | None = None,
    show_email: bool | None = None,
    status_text: str | None = None,
    status_public: bool | None = None,
    clear_fields: list[str] | None = None,
) -> dict[str, Any]:
    identity = _identity()
    supplied = {
        "display_name": display_name, "headline": headline, "bio": bio,
        "avatar_url": avatar_url, "cover_url": cover_url, "interest_tags": interest_tags,
        "github_url": github_url, "email": email, "show_email": show_email,
        "status_text": status_text, "status_public": status_public,
    }
    updates = {key: value for key, value in supplied.items() if value is not None}
    clearable = {"avatar_url", "cover_url", "github_url", "email", "status_text"}
    for field in clear_fields or []:
        if field not in clearable:
            raise ValueError(f"Field cannot be cleared: {field}")
        updates[field] = None
    if not updates:
        raise ValueError("Provide at least one field to update.")
    with SessionLocal() as db:
        profile = load_site_profile(db, for_update=True)
        updated = SiteProfile.model_validate({**profile.model_dump(), **updates})
        save_site_profile(db, updated, identity.user_id)
        return updated.model_dump(mode="json")


@library_mcp.tool(description="Create or update one public or hidden external link.")
def upsert_library_link(
    label: str,
    url: str,
    link_id: str | None = None,
    is_public: bool = True,
) -> dict[str, Any]:
    identity = _identity()
    with SessionLocal() as db:
        profile = load_site_profile(db, for_update=True)
        links = list(profile.links)
        target_id = link_id or str(uuid.uuid4())
        item = SiteProfileLink(
            id=target_id, label=label, url=url, is_public=is_public,
            sort_order=next((x.sort_order for x in links if x.id == target_id), len(links)),
        )
        index = next((i for i, value in enumerate(links) if value.id == target_id), None)
        if index is None:
            if len(links) >= 20:
                raise ValueError("The library already has the maximum number of links.")
            links.append(item)
        else:
            links[index] = item
        updated = profile.model_copy(update={"links": links})
        save_site_profile(db, updated, identity.user_id)
        return item.model_dump(mode="json")


@library_mcp.tool(description="List all collection cards, including hidden cards.")
def list_library_media_cards() -> list[dict[str, Any]]:
    _identity()
    with SessionLocal() as db:
        return [item.model_dump(mode="json") for item in load_site_profile(db).media_cards]


@library_mcp.tool(description="Create or update a collection card. Changes take effect immediately.")
def upsert_library_media_card(
    title: str,
    category: Literal["book", "movie", "music", "status", "other"] | None = None,
    card_id: str | None = None,
    creator: str | None = None,
    year: str | None = None,
    badge: str | None = None,
    note: str | None = None,
    image_url: str | None = None,
    url: str | None = None,
    is_public: bool | None = None,
    is_featured: bool | None = None,
    clear_fields: list[str] | None = None,
) -> dict[str, Any]:
    identity = _identity()
    with SessionLocal() as db:
        profile = load_site_profile(db, for_update=True)
        old = next((x for x in profile.media_cards if x.id == card_id), None)
        optional = {"creator": creator, "year": year, "badge": badge, "note": note, "image_url": image_url, "url": url}
        clearable = set(optional)
        for field in clear_fields or []:
            if field not in clearable:
                raise ValueError(f"Field cannot be cleared: {field}")
            optional[field] = None
        if old:
            optional = {key: (getattr(old, key) if value is None and key not in (clear_fields or []) else value) for key, value in optional.items()}
        public_value = is_public if is_public is not None else (old.is_public if old else True)
        featured_value = is_featured if is_featured is not None else (old.is_featured if old else False)
        if featured_value and not public_value:
            raise ValueError("A hidden collection card cannot be featured on the home page.")
        user = db.get(User, identity.user_id)
        if not user:
            raise ValueError("MCP library user no longer exists.")
        _, item = library_actions.upsert_media_card(
            db,
            user,
            library_actions.UpsertLibraryMediaCardArguments(
                card_id=card_id,
                title=title,
                category=category or (old.category if old else "other"),
                **optional,
                is_public=public_value,
                is_featured=featured_value,
            ),
        )
        return item.model_dump(mode="json")


@library_mcp.tool(description="Upload an image to Lumino's configured image bed.")
async def upload_library_image(filename: str, content_base64: str, content_type: str = "image/png"):
    _identity()
    if not content_type.startswith("image/"):
        raise ValueError("Only image uploads are supported.")
    encoded = content_base64.split(",", 1)[-1] if "," in content_base64 else content_base64
    try:
        content = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("content_base64 must be valid base64 image data.") from exc
    if not content or len(content) > settings.MCP_LIBRARY_MAX_IMAGE_BYTES:
        raise ValueError("Image size is empty or too large.")
    with SessionLocal() as db:
        try:
            url = await upload_file_to_lsky(filename, content, content_type, db)
        except HTTPException as exc:
            raise ValueError(exc.detail) from exc
    return {"url": url}


class MCPLibraryTokenMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        headers = {k.decode("latin-1").lower(): v.decode("latin-1") for k, v in scope["headers"]}
        token = headers.get("authorization", "").removeprefix("Bearer ").strip()
        with SessionLocal() as db:
            identity = resolve_mcp_library_identity(db, token)
        if not identity:
            response = JSONResponse({"detail": "Invalid MCP library token."}, status_code=401, headers={"WWW-Authenticate": "Bearer"})
            await response(scope, receive, send)
            return
        context_token = current_mcp_library_identity.set(identity)
        try:
            await self.app(scope, receive, send)
        finally:
            current_mcp_library_identity.reset(context_token)


library_mcp_asgi = MCPLibraryTokenMiddleware(library_mcp.streamable_http_app())
