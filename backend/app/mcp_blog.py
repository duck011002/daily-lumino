"""A narrowly scoped MCP server for drafting and publishing Lumino blog posts."""

import base64
import binascii
import re
import uuid
from datetime import UTC, datetime
from hmac import compare_digest
from typing import Any

from fastapi import HTTPException
from mcp.server.fastmcp import FastMCP
from sqlalchemy import select
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from app.config import settings
from app.database import SessionLocal
from app.models.blog import BlogCategory, BlogPost
from app.models.user import User
from app.services.upload import upload_file_to_lsky

blog_mcp = FastMCP(
    "Lumino Blog",
    instructions=(
        "Use these tools to create technical blog drafts for Lumino. "
        "Always list categories first, upload images through the image tool, and request "
        "an explicit publish step only when the user has approved publishing."
    ),
    stateless_http=True,
    json_response=True,
    streamable_http_path="/",
)


def _get_mcp_author(db) -> User:
    if settings.MCP_BLOG_AUTHOR_ID is None:
        raise ValueError("MCP_BLOG_AUTHOR_ID has not been configured.")
    author = db.get(User, settings.MCP_BLOG_AUTHOR_ID)
    if not author or not author.is_active or (not author.is_root and not author.can_write_blog):
        raise ValueError("The configured MCP blog author is unavailable or lacks blog permission.")
    return author


def _get_category(db, category_slug: str | None) -> BlogCategory | None:
    if not category_slug:
        return None
    category = db.scalar(select(BlogCategory).where(BlogCategory.slug == category_slug))
    if not category:
        raise ValueError("The requested blog category does not exist.")
    return category


def _new_slug(title: str, supplied_slug: str | None) -> str:
    candidate = supplied_slug or title
    candidate = re.sub(r"[^a-zA-Z0-9]+", "-", candidate.lower()).strip("-")
    if not candidate:
        candidate = "post"
    return f"{candidate[:260]}-{uuid.uuid4().hex[:8]}"


def _create_post(
    *,
    title: str,
    content: str,
    category_slug: str | None,
    excerpt: str | None,
    cover_url: str | None,
    tags: list[str] | None,
    supplied_slug: str | None,
    publish: bool,
) -> dict[str, Any]:
    if not title.strip() or not content.strip():
        raise ValueError("title and content are required.")

    with SessionLocal() as db:
        author = _get_mcp_author(db)
        category = _get_category(db, category_slug)
        slug = _new_slug(title, supplied_slug)
        while db.scalar(select(BlogPost.id).where(BlogPost.slug == slug)):
            slug = _new_slug(title, supplied_slug)

        can_publish = publish and settings.MCP_BLOG_ALLOW_AUTO_PUBLISH
        post = BlogPost(
            title=title.strip(),
            slug=slug,
            content=content,
            excerpt=excerpt,
            cover_url=cover_url,
            tags=tags,
            category_id=category.id if category else None,
            author_id=author.id,
            is_public=can_publish,
            is_published=can_publish,
            published_at=datetime.now(UTC).replace(tzinfo=None) if can_publish else None,
        )
        db.add(post)
        db.commit()
        db.refresh(post)

        return {
            "id": post.id,
            "slug": post.slug,
            "status": "published" if can_publish else "draft",
            "url": (
                f"{settings.FRONTEND_BASE_URL.rstrip('/')}/blog/{post.slug}"
                if can_publish
                else None
            ),
            "notice": (
                "Auto-publish is disabled, so this post was created as a private draft."
                if publish and not can_publish
                else None
            ),
        }


@blog_mcp.tool(description="List the available public-facing technical blog categories.")
def list_blog_categories() -> list[dict[str, Any]]:
    with SessionLocal() as db:
        categories = db.scalars(
            select(BlogCategory).order_by(BlogCategory.sort_order, BlogCategory.name)
        ).all()
        return [
            {
                "slug": category.slug,
                "name": category.name,
                "description": category.description,
            }
            for category in categories
        ]


@blog_mcp.tool(
    description="Upload one image to the configured Lumino image bed and return its public URL."
)
async def upload_blog_image(
    filename: str,
    content_base64: str,
    content_type: str = "image/png",
) -> dict[str, str]:
    if not content_type.startswith("image/"):
        raise ValueError("Only image uploads are supported.")
    encoded = content_base64.split(",", 1)[-1] if "," in content_base64 else content_base64
    try:
        content = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("content_base64 must be valid base64 image data.") from exc
    if not content or len(content) > settings.MCP_BLOG_MAX_IMAGE_BYTES:
        raise ValueError("Image size is empty or exceeds MCP_BLOG_MAX_IMAGE_BYTES.")

    with SessionLocal() as db:
        try:
            url = await upload_file_to_lsky(filename, content, content_type, db)
        except HTTPException as exc:
            raise ValueError(exc.detail) from exc
    return {"url": url}


@blog_mcp.tool(
    description=(
        "Create a technical blog post. It is a draft unless publish is true "
        "and auto-publish is enabled."
    )
)
def create_blog_post(
    title: str,
    content: str,
    category_slug: str | None = None,
    excerpt: str | None = None,
    cover_url: str | None = None,
    tags: list[str] | None = None,
    slug: str | None = None,
    publish: bool = False,
) -> dict[str, Any]:
    return _create_post(
        title=title,
        content=content,
        category_slug=category_slug,
        excerpt=excerpt,
        cover_url=cover_url,
        tags=tags,
        supplied_slug=slug,
        publish=publish,
    )


@blog_mcp.tool(
    description="Publish a previously created MCP blog draft after explicit user approval."
)
def publish_blog_post(post_id: int) -> dict[str, str]:
    if not settings.MCP_BLOG_ALLOW_AUTO_PUBLISH:
        raise ValueError(
            "Auto-publish is disabled. Publish the draft from Lumino's blog workspace."
        )

    with SessionLocal() as db:
        author = _get_mcp_author(db)
        post = db.get(BlogPost, post_id)
        if not post or post.author_id != author.id:
            raise ValueError("The MCP blog draft was not found.")
        post.is_public = True
        post.is_published = True
        if not post.published_at:
            post.published_at = datetime.now(UTC).replace(tzinfo=None)
        db.commit()
        return {
            "status": "published",
            "url": f"{settings.FRONTEND_BASE_URL.rstrip('/')}/blog/{post.slug}",
        }


class MCPBlogTokenMiddleware:
    """Protect the MCP endpoint with a dedicated non-user bearer token."""

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
        authorization = headers.get("authorization", "")
        token = authorization.removeprefix("Bearer ")
        if not settings.MCP_BLOG_TOKEN or not compare_digest(token, settings.MCP_BLOG_TOKEN):
            response = JSONResponse(
                {"detail": "Invalid MCP blog token."},
                status_code=401,
                headers={"WWW-Authenticate": "Bearer"},
            )
            await response(scope, receive, send)
            return
        await self.app(scope, receive, send)


blog_mcp_asgi = MCPBlogTokenMiddleware(blog_mcp.streamable_http_app())
