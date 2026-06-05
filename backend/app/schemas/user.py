from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    display_name: str | None = Field(None, max_length=100)
    avatar_url: str | None = Field(None, max_length=500)


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=255)
    invite_code: str | None = None


class UserUpdate(BaseModel):
    display_name: str | None = Field(None, max_length=100)
    avatar_url: str | None = Field(None, max_length=500)
    password: str | None = Field(None, min_length=8, max_length=255)


class UserResponse(UserBase):
    id: int
    is_root: bool
    is_active: bool
    can_create_spaces: bool
    is_discipline_authorized: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
