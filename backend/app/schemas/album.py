from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class AlbumCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    cover_url: Optional[str] = Field(None, max_length=500)


class AlbumUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    cover_url: Optional[str] = Field(None, max_length=500)


class AlbumResponse(BaseModel):
    id: int
    space_id: int
    name: str
    cover_url: Optional[str] = None
    created_by: int
    created_at: datetime
    photo_count: int = 0

    class Config:
        from_attributes = True


class PhotoResponse(BaseModel):
    id: int
    album_id: int
    space_id: int
    uploader_id: int
    url: str
    thumb_url: Optional[str] = None
    caption: Optional[str] = None
    taken_at: Optional[datetime] = None
    file_size_kb: int
    created_at: datetime

    class Config:
        from_attributes = True
