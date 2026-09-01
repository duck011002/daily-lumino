from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field

from app.schemas.user import UserResponse


class BlogCategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    slug: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=300)
    sort_order: int = 0


class BlogCategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    slug: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=300)
    sort_order: Optional[int] = None


class BlogCategoryResponse(BaseModel):
    id: int
    name: str
    slug: str
    description: Optional[str] = None
    sort_order: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BlogPostCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    slug: str = Field(..., min_length=1, max_length=300)
    content: str = Field(..., min_length=1)
    cover_url: Optional[str] = Field(None, max_length=500)
    excerpt: Optional[str] = None
    is_public: bool = False
    is_published: bool = False
    tags: Optional[List[str]] = None
    category_id: Optional[int] = None


class BlogPostUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=300)
    slug: Optional[str] = Field(None, min_length=1, max_length=300)
    content: Optional[str] = Field(None, min_length=1)
    cover_url: Optional[str] = Field(None, max_length=500)
    excerpt: Optional[str] = None
    is_public: Optional[bool] = None
    is_published: Optional[bool] = None
    is_featured: Optional[bool] = None
    tags: Optional[List[str]] = None
    category_id: Optional[int] = None


class BlogAdjacentPost(BaseModel):
    id: int
    title: str
    slug: str
    cover_url: Optional[str] = None
    published_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BlogPostResponse(BaseModel):
    id: int
    title: str
    slug: str
    content: str
    cover_url: Optional[str] = None
    excerpt: Optional[str] = None
    is_public: bool
    is_published: bool
    is_featured: bool
    tags: Optional[List[str]] = None
    author_id: int
    view_count: int
    published_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    author: Optional[UserResponse] = None
    category: Optional[BlogCategoryResponse] = None
    prev_post: Optional[BlogAdjacentPost] = None
    next_post: Optional[BlogAdjacentPost] = None

    class Config:
        from_attributes = True


class BlogPostListItemResponse(BaseModel):
    id: int
    title: str
    slug: str
    cover_url: Optional[str] = None
    excerpt: Optional[str] = None
    is_public: bool
    is_published: bool
    is_featured: bool
    tags: Optional[List[str]] = None
    author_id: int
    view_count: int
    published_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    author: Optional[UserResponse] = None
    category: Optional[BlogCategoryResponse] = None

    class Config:
        from_attributes = True


class BlogPostPageResponse(BaseModel):
    items: List[BlogPostListItemResponse]
    total: int
    page: int
    page_size: int
    pages: int
