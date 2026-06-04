from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field

from app.schemas.user import UserResponse


class BlogPostCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    slug: str = Field(..., min_length=1, max_length=300)
    content: str = Field(..., min_length=1)
    cover_url: Optional[str] = Field(None, max_length=500)
    excerpt: Optional[str] = None
    is_public: bool = False
    is_published: bool = False
    tags: Optional[List[str]] = None


class BlogPostUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=300)
    slug: Optional[str] = Field(None, min_length=1, max_length=300)
    content: Optional[str] = Field(None, min_length=1)
    cover_url: Optional[str] = Field(None, max_length=500)
    excerpt: Optional[str] = None
    is_public: Optional[bool] = None
    is_published: Optional[bool] = None
    tags: Optional[List[str]] = None


class BlogPostResponse(BaseModel):
    id: int
    title: str
    slug: str
    content: str
    cover_url: Optional[str] = None
    excerpt: Optional[str] = None
    is_public: bool
    is_published: bool
    tags: Optional[List[str]] = None
    author_id: int
    view_count: int
    published_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    author: Optional[UserResponse] = None

    class Config:
        from_attributes = True
