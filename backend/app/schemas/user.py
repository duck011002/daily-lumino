from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    display_name: str | None = Field(None, max_length=100)
    avatar_url: str | None = Field(None, max_length=500)


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=255)
    invite_code: str = Field(..., min_length=1, max_length=64)


class UserUpdate(BaseModel):
    display_name: str | None = Field(None, max_length=100)
    avatar_url: str | None = Field(None, max_length=500)
    password: str | None = Field(None, min_length=8, max_length=255)


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    display_name: str | None = None
    avatar_url: str | None = None
    is_root: bool
    is_active: bool
    can_create_spaces: bool
    is_discipline_authorized: bool
    can_write_blog: bool
    can_use_mcp: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
