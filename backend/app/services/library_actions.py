from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field, model_validator
from sqlalchemy.orm import Session

from app.models.user import User
from app.routers.site import load_site_profile, save_site_profile
from app.schemas.site import SiteMediaCard, SiteProfile


class UpdateLibraryProfileArguments(BaseModel):
    display_name: str | None = Field(None, min_length=1, max_length=80)
    headline: str | None = Field(None, min_length=1, max_length=180)
    bio: str | None = Field(None, min_length=1, max_length=2000)
    avatar_url: str | None = Field(None, max_length=500)
    cover_url: str | None = Field(None, max_length=500)
    interest_tags: list[str] | None = None
    github_url: str | None = Field(None, max_length=500)
    email: str | None = Field(None, max_length=200)
    show_email: bool | None = None
    status_text: str | None = Field(None, max_length=300)
    status_public: bool | None = None

    @model_validator(mode="after")
    def require_change(self):
        if not self.model_fields_set:
            raise ValueError("至少提供一个要更新的 Library 字段。")
        return self


class UpsertLibraryMediaCardArguments(BaseModel):
    title: str = Field(..., min_length=1, max_length=160)
    card_id: str | None = Field(None, max_length=80)
    category: Literal["book", "movie", "music", "status", "other"] = "other"
    subtitle: str | None = Field(None, max_length=240)
    creator: str | None = Field(None, max_length=160)
    year: str | None = Field(None, max_length=20)
    badge: str | None = Field(None, max_length=40)
    note: str | None = Field(None, max_length=500)
    image_url: str | None = Field(None, max_length=500)
    url: str | None = Field(None, max_length=500)
    is_public: bool = True
    is_featured: bool = False


def ensure_root(user: User) -> None:
    if not user.is_root:
        raise PermissionError("只有超级管理员可以修改 Library。")


def update_profile(
    db: Session,
    user: User,
    payload: UpdateLibraryProfileArguments,
    *,
    commit: bool = True,
) -> SiteProfile:
    ensure_root(user)
    current = load_site_profile(db, for_update=True)
    updated = SiteProfile.model_validate(
        {**current.model_dump(), **payload.model_dump(exclude_unset=True)}
    )
    return save_site_profile(db, updated, user.id, commit=commit)


def upsert_media_card(
    db: Session,
    user: User,
    payload: UpsertLibraryMediaCardArguments,
    *,
    commit: bool = True,
) -> tuple[SiteProfile, SiteMediaCard]:
    ensure_root(user)
    profile = load_site_profile(db, for_update=True)
    cards = list(profile.media_cards)
    target_id = payload.card_id or str(uuid4())
    old = next((item for item in cards if item.id == target_id), None)
    if not old and len(cards) >= 24:
        raise ValueError("Library 收藏卡片已达到 24 张上限。")
    if payload.is_featured and not payload.is_public:
        raise ValueError("隐藏卡片不能设为精选。")
    values = (
        old.model_dump()
        if old
        else {"id": target_id, "sort_order": len(cards)}
    )
    values.update(payload.model_dump(exclude={"card_id"}, exclude_unset=bool(old)))
    values["id"] = target_id
    item = SiteMediaCard.model_validate(values)
    if old:
        cards[cards.index(old)] = item
    else:
        cards.append(item)
    updated = profile.model_copy(update={"media_cards": cards})
    save_site_profile(db, updated, user.id, commit=commit)
    return updated, item
