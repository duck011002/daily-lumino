from datetime import datetime

from pydantic import BaseModel, Field


class UserStatusUpdate(BaseModel):
    is_active: bool | None = None
    can_create_spaces: bool | None = None
    is_discipline_authorized: bool | None = None
    can_write_blog: bool | None = None



class SystemConfigResponse(BaseModel):
    id: int
    config_key: str
    config_val: str | None
    description: str | None
    updated_at: datetime

    class Config:
        from_attributes = True


class SystemConfigUpdate(BaseModel):
    config_val: str


class StorageQuotaResponse(BaseModel):
    id: int
    max_size_mb: float
    used_size_mb: float
    updated_at: datetime

    class Config:
        from_attributes = True


class StorageQuotaUpdate(BaseModel):
    max_size_mb: float


class InviteCodeCreate(BaseModel):
    expires_in_hours: int | None = Field(None, description="Expiration time in hours")


class InviteCodeResponse(BaseModel):
    id: int
    code: str
    created_by: int
    used_by: int | None
    expires_at: datetime | None
    used_at: datetime | None
    created_at: datetime

    class Config:
        from_attributes = True


class MCPBlogTokenCreate(BaseModel):
    label: str = Field(..., min_length=1, max_length=100)
    author_id: int
    allow_auto_publish: bool = False


class MCPBlogTokenUpdate(BaseModel):
    author_id: int | None = None
    allow_auto_publish: bool | None = None
    is_active: bool | None = None


class MCPBlogTokenResponse(BaseModel):
    id: int
    label: str
    author_id: int
    author_name: str
    allow_auto_publish: bool
    is_active: bool
    created_at: datetime
    last_used_at: datetime | None


class MCPBlogTokenCreateResponse(MCPBlogTokenResponse):
    token: str


class AITestConnectionRequest(BaseModel):
    id: str | None = None
    base_url: str | None = None
    api_key: str
    model: str


class AIGetModelsRequest(BaseModel):
    id: str | None = None
    base_url: str | None = None
    api_key: str


from app.schemas.user import UserResponse

class UserAdminResponse(UserResponse):
    token_usage: int
    space_count: int
    blog_count: int

    class Config:
        from_attributes = True

