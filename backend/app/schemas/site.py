from typing import Literal
from urllib.parse import urlparse

from pydantic import BaseModel, Field, field_validator


def validate_optional_url(value: str | None, *, allow_mailto: bool = False) -> str | None:
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    if value.startswith("/"):
        return value
    parsed = urlparse(value)
    allowed_schemes = {"http", "https"}
    if allow_mailto:
        allowed_schemes.add("mailto")
    if parsed.scheme not in allowed_schemes:
        raise ValueError("链接仅支持 http、https、站内路径或 mailto。")
    return value


class SiteProfileLink(BaseModel):
    id: str = Field(..., min_length=1, max_length=80)
    label: str = Field(..., min_length=1, max_length=80)
    url: str = Field(..., min_length=1, max_length=500)
    is_public: bool = True
    sort_order: int = 0

    @field_validator("url")
    @classmethod
    def validate_url(cls, value: str) -> str:
        validated = validate_optional_url(value, allow_mailto=True)
        if not validated:
            raise ValueError("链接不能为空。")
        return validated


class SiteMediaCard(BaseModel):
    id: str = Field(..., min_length=1, max_length=80)
    category: Literal["book", "movie", "music", "status", "other"] = "other"
    title: str = Field(..., min_length=1, max_length=160)
    subtitle: str | None = Field(None, max_length=240)
    creator: str | None = Field(None, max_length=160)
    year: str | None = Field(None, max_length=20)
    badge: str | None = Field(None, max_length=40)
    note: str | None = Field(None, max_length=500)
    image_url: str | None = Field(None, max_length=500)
    url: str | None = Field(None, max_length=500)
    is_public: bool = True
    sort_order: int = 0

    @field_validator("image_url")
    @classmethod
    def validate_image_url(cls, value: str | None) -> str | None:
        return validate_optional_url(value)

    @field_validator("url")
    @classmethod
    def validate_url(cls, value: str | None) -> str | None:
        return validate_optional_url(value)


class SiteProfile(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=80)
    headline: str = Field(..., min_length=1, max_length=180)
    bio: str = Field(..., min_length=1, max_length=2000)
    avatar_url: str | None = Field(None, max_length=500)
    cover_url: str | None = Field(None, max_length=500)
    interest_tags: list[str] = Field(default_factory=list, max_length=16)
    github_url: str | None = Field(None, max_length=500)
    email: str | None = Field(None, max_length=200)
    show_email: bool = True
    status_text: str | None = Field(None, max_length=300)
    status_public: bool = True
    links: list[SiteProfileLink] = Field(default_factory=list, max_length=20)
    media_cards: list[SiteMediaCard] = Field(default_factory=list, max_length=24)

    @field_validator("avatar_url", "cover_url", "github_url")
    @classmethod
    def validate_url(cls, value: str | None) -> str | None:
        return validate_optional_url(value)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            return None
        if "@" not in value or value.startswith("@") or value.endswith("@"):
            raise ValueError("请输入有效的公开邮箱。")
        return value

    @field_validator("interest_tags")
    @classmethod
    def normalize_tags(cls, values: list[str]) -> list[str]:
        normalized: list[str] = []
        for value in values:
            tag = value.strip()[:40]
            if tag and tag not in normalized:
                normalized.append(tag)
        return normalized[:16]
