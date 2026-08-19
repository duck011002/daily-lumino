from dataclasses import dataclass
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
    allow_same_title: bool = False


class LibraryDuplicateError(ValueError):
    def __init__(self, existing_id: str):
        self.existing_id = existing_id
        super().__init__(f"Library item already exists (card {existing_id}).")


class LibraryConflictError(ValueError):
    def __init__(self, existing_id: str):
        self.existing_id = existing_id
        super().__init__(
            f"Library has a same-title item with different details (card {existing_id})."
        )


@dataclass(frozen=True)
class LibraryMatch:
    kind: Literal["exact", "conflict"]
    card: SiteMediaCard


def normalize_library_text(value: str | None) -> str:
    return " ".join((value or "").strip().split()).casefold()


def normalize_library_url(value: str | None) -> str:
    return (value or "").strip().rstrip("/").casefold()


def find_media_card_match(
    profile: SiteProfile,
    payload: UpsertLibraryMediaCardArguments,
    *,
    exclude_id: str | None = None,
) -> LibraryMatch | None:
    candidate_url = normalize_library_url(payload.url)
    for card in profile.media_cards:
        if exclude_id and card.id == exclude_id:
            continue
        if candidate_url and normalize_library_url(card.url) == candidate_url:
            return LibraryMatch("exact", card)
        same_title = (
            card.category == payload.category
            and normalize_library_text(card.title)
            == normalize_library_text(payload.title)
        )
        if not same_title:
            continue
        same_details = (
            normalize_library_text(card.creator)
            == normalize_library_text(payload.creator)
            and normalize_library_text(card.year)
            == normalize_library_text(payload.year)
        )
        return LibraryMatch("exact" if same_details else "conflict", card)
    return None


def search_media_cards(db: Session, query: str) -> list[SiteMediaCard]:
    needle = normalize_library_text(query)
    cards = load_site_profile(db).media_cards
    if not needle:
        return list(cards)
    return [
        card
        for card in cards
        if needle
        in normalize_library_text(
            " ".join(
                value
                for value in (
                    card.title,
                    card.subtitle,
                    card.creator,
                    card.year,
                    card.note,
                    card.url,
                )
                if value
            )
        )
    ]


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
    match = find_media_card_match(profile, payload, exclude_id=target_id if old else None)
    if match and match.kind == "exact":
        raise LibraryDuplicateError(match.card.id)
    if match and match.kind == "conflict" and not payload.allow_same_title:
        raise LibraryConflictError(match.card.id)
    if not old and len(cards) >= 24:
        raise ValueError("Library 收藏卡片已达到 24 张上限。")
    if payload.is_featured and not payload.is_public:
        raise ValueError("隐藏卡片不能设为精选。")
    values = (
        old.model_dump()
        if old
        else {"id": target_id, "sort_order": len(cards)}
    )
    values.update(
        payload.model_dump(
            exclude={"card_id", "allow_same_title"}, exclude_unset=bool(old)
        )
    )
    values["id"] = target_id
    item = SiteMediaCard.model_validate(values)
    if old:
        cards[cards.index(old)] = item
    else:
        cards.append(item)
    updated = profile.model_copy(update={"media_cards": cards})
    save_site_profile(db, updated, user.id, commit=commit)
    return updated, item
