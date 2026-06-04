from datetime import datetime

from pydantic import BaseModel, Field


class UserStatusUpdate(BaseModel):
    is_active: bool


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
