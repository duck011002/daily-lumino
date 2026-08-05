from datetime import datetime

from pydantic import BaseModel, Field


class AICapabilitiesResponse(BaseModel):
    can_chat: bool
    can_generate: bool
    can_publish_blog: bool
    can_publish_space: bool
    can_mcp_publish: bool
    allow_auto_publish: bool


class AIDraftCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    content: str = Field(..., min_length=1)
    target: str = Field(..., pattern="^(blog|space)$")
    space_id: int | None = None
    excerpt: str | None = None
    cover_url: str | None = None
    tags: list[str] | None = None
    category_id: int | None = None
    publish: bool = False


class AIDraftResponse(BaseModel):
    target: str
    id: int
    status: str
    url: str | None = None
    created_at: datetime | None = None


class AIIngestResponse(BaseModel):
    id: int
    filename: str
    media_type: str
    size_bytes: int
    status: str
    extracted_text: str | None = None
    error_message: str | None = None
    created_at: datetime | None = None
