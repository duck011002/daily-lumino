from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

from app.schemas.user import UserResponse


class NoteCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    content: Optional[str] = None
    cover_url: Optional[str] = Field(None, max_length=500)
    is_published: bool = True


class NoteUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=300)
    content: Optional[str] = None
    cover_url: Optional[str] = Field(None, max_length=500)
    is_published: Optional[bool] = None


class NoteResponse(BaseModel):
    id: int
    space_id: int
    title: str
    content: Optional[str] = None
    cover_url: Optional[str] = None
    author_id: int
    lock_by: Optional[int] = None
    lock_at: Optional[datetime] = None
    is_published: bool
    created_at: datetime
    updated_at: datetime
    author: Optional[UserResponse] = None
    locked_user: Optional[UserResponse] = None

    class Config:
        from_attributes = True
