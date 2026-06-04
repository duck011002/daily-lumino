from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from app.models.space import SpaceMemberRole, SpaceType


# ---------- Space ----------
class SpaceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    type: SpaceType
    description: Optional[str] = Field(None, max_length=500)
    cover_url: Optional[str] = Field(None, max_length=500)


class SpaceUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    cover_url: Optional[str] = Field(None, max_length=500)


class SpaceMemberResponse(BaseModel):
    id: int
    user_id: int
    username: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    role: SpaceMemberRole
    joined_at: datetime

    class Config:
        from_attributes = True


class SpaceResponse(BaseModel):
    id: int
    name: str
    type: SpaceType
    description: Optional[str] = None
    cover_url: Optional[str] = None
    created_by: int
    created_at: datetime
    member_count: int = 0

    class Config:
        from_attributes = True


class SpaceDetailResponse(SpaceResponse):
    members: List[SpaceMemberResponse] = []


# ---------- Space Invite ----------
class SpaceInviteCreate(BaseModel):
    expires_in_hours: Optional[int] = Field(72, ge=1, le=720, description="邀请码有效时长（小时）")
    max_uses: int = Field(1, ge=1, le=50, description="最大使用次数")


class SpaceInviteResponse(BaseModel):
    id: int
    code: str
    space_id: int
    created_by: int
    max_uses: int
    used_count: int
    expires_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SpaceInviteJoin(BaseModel):
    code: str = Field(..., min_length=8, max_length=32)


# ---------- Storage Quota ----------
class StorageQuotaInfo(BaseModel):
    max_size_mb: float
    used_size_mb: float
    remaining_mb: float
    usage_percent: float

    class Config:
        from_attributes = True
