import re
from datetime import UTC, datetime
from uuid import uuid4

from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.blog import BlogCategory, BlogPost
from app.models.user import User


class CreateBlogPostArguments(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    content: str = Field(..., min_length=1)
    slug: str | None = Field(None, max_length=300)
    excerpt: str | None = None
    cover_url: str | None = Field(None, max_length=500)
    tags: list[str] | None = None
    category_id: int | None = None


class UpdateBlogPostArguments(BaseModel):
    post_id: int = Field(..., gt=0)
    title: str | None = Field(None, min_length=1, max_length=300)
    content: str | None = Field(None, min_length=1)
    slug: str | None = Field(None, min_length=1, max_length=300)
    excerpt: str | None = None
    cover_url: str | None = Field(None, max_length=500)
    tags: list[str] | None = None
    category_id: int | None = None


class PublishBlogPostArguments(BaseModel):
    post_id: int = Field(..., gt=0)


def ensure_writer(user: User) -> None:
    if not user.is_root and not user.can_write_blog:
        raise PermissionError("当前用户没有博客写作权限。")


def _slug(db: Session, title: str, supplied: str | None) -> str:
    source = supplied or title
    base = re.sub(r"[^a-zA-Z0-9]+", "-", source.lower()).strip("-") or "post"
    candidate = base[:270]
    while db.scalar(select(BlogPost.id).where(BlogPost.slug == candidate)):
        candidate = f"{base[:260]}-{uuid4().hex[:8]}"
    return candidate


def _validate_category(db: Session, category_id: int | None) -> None:
    if category_id is not None and not db.get(BlogCategory, category_id):
        raise ValueError("博客分区不存在。")


def get_owned_post(db: Session, user: User, post_id: int) -> BlogPost:
    ensure_writer(user)
    post = db.get(BlogPost, post_id)
    if (
        not post
        or post.deleted_at is not None
        or (not user.is_root and post.author_id != user.id)
    ):
        raise ValueError("博客文章不存在或不属于当前用户。")
    return post


def serialize_post(post: BlogPost) -> dict:
    return {
        "id": post.id,
        "title": post.title,
        "slug": post.slug,
        "content": post.content,
        "excerpt": post.excerpt,
        "cover_url": post.cover_url,
        "tags": post.tags,
        "category_id": post.category_id,
        "is_public": post.is_public,
        "is_published": post.is_published,
        "published_at": post.published_at.isoformat() if post.published_at else None,
    }


def create_draft(
    db: Session,
    user: User,
    payload: CreateBlogPostArguments,
    *,
    commit: bool = True,
) -> BlogPost:
    ensure_writer(user)
    _validate_category(db, payload.category_id)
    post = BlogPost(
        title=payload.title.strip(),
        slug=_slug(db, payload.title, payload.slug),
        content=payload.content,
        excerpt=payload.excerpt,
        cover_url=payload.cover_url,
        tags=payload.tags,
        category_id=payload.category_id,
        author_id=user.id,
        is_public=False,
        is_published=False,
    )
    db.add(post)
    if commit:
        db.commit()
        db.refresh(post)
    else:
        db.flush()
    return post


def update_post(
    db: Session,
    user: User,
    payload: UpdateBlogPostArguments,
    *,
    commit: bool = True,
) -> BlogPost:
    post = get_owned_post(db, user, payload.post_id)
    changes = payload.model_dump(exclude={"post_id"}, exclude_unset=True)
    if "slug" in changes and changes["slug"] != post.slug:
        conflict = db.scalar(
            select(BlogPost.id).where(
                BlogPost.slug == changes["slug"], BlogPost.id != post.id
            )
        )
        if conflict:
            raise ValueError("博客 slug 已存在。")
    if "category_id" in changes:
        _validate_category(db, changes["category_id"])
    for field, value in changes.items():
        setattr(post, field, value)
    if commit:
        db.commit()
        db.refresh(post)
    else:
        db.flush()
    return post


def publish_post(
    db: Session, user: User, post_id: int, *, commit: bool = True
) -> BlogPost:
    post = get_owned_post(db, user, post_id)
    post.is_public = True
    post.is_published = True
    if not post.published_at:
        post.published_at = datetime.now(UTC).replace(tzinfo=None)
    if commit:
        db.commit()
        db.refresh(post)
    else:
        db.flush()
    return post


def delete_post(db: Session, user: User, post_id: int, *, commit: bool = True) -> None:
    post = get_owned_post(db, user, post_id)
    post.deleted_at = datetime.now(UTC).replace(tzinfo=None)
    post.is_featured = False
    if commit:
        db.commit()
    else:
        db.flush()
