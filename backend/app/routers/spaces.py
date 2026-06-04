import secrets
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.space import Space, SpaceInvite, SpaceMember, SpaceMemberRole
from app.models.storage_quota import StorageQuota
from app.models.system_config import SystemConfig
from app.models.user import User
from app.schemas.space import (
    SpaceCreate,
    SpaceDetailResponse,
    SpaceInviteCreate,
    SpaceInviteJoin,
    SpaceInviteResponse,
    SpaceMemberResponse,
    SpaceResponse,
    SpaceUpdate,
    StorageQuotaInfo,
)

router = APIRouter(prefix="/api/spaces", tags=["spaces"])


# ========== Helpers ==========

def get_space_or_404(db: Session, space_id: int) -> Space:
    space = db.get(Space, space_id)
    if not space:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="空间不存在。")
    return space


def require_membership(db: Session, space_id: int, user_id: int) -> SpaceMember:
    member = db.scalar(
        select(SpaceMember).where(
            SpaceMember.space_id == space_id, SpaceMember.user_id == user_id
        )
    )
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="您不是该空间的成员，无权访问。")
    return member


def require_owner(db: Session, space_id: int, user_id: int) -> SpaceMember:
    member = require_membership(db, space_id, user_id)
    if member.role != SpaceMemberRole.OWNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="只有空间所有者才能执行此操作。"
        )
    return member


def build_member_response(member: SpaceMember) -> SpaceMemberResponse:
    return SpaceMemberResponse(
        id=member.id,
        user_id=member.user_id,
        username=member.user.username,
        display_name=member.user.display_name,
        avatar_url=member.user.avatar_url,
        role=member.role,
        joined_at=member.joined_at,
    )


def build_space_response(space: Space) -> SpaceResponse:
    return SpaceResponse(
        id=space.id,
        name=space.name,
        type=space.type,
        description=space.description,
        cover_url=space.cover_url,
        created_by=space.created_by,
        created_at=space.created_at,
        member_count=len(space.members),
    )


def get_storage_quota_info(db: Session) -> StorageQuotaInfo:
    quota = db.scalar(select(StorageQuota))
    if not quota:
        quota = StorageQuota(max_size_mb=Decimal("1024.00"), used_size_mb=Decimal("0.00"))
        db.add(quota)
        db.commit()
        db.refresh(quota)

    # Also read from system_configs for the canonical value
    config_quota = db.scalar(
        select(SystemConfig).where(SystemConfig.config_key == "storage_quota_mb")
    )
    max_mb = float(quota.max_size_mb)
    if config_quota and config_quota.config_val:
        try:
            max_mb = float(config_quota.config_val)
        except ValueError:
            pass

    used_mb = float(quota.used_size_mb)
    remaining = max(0.0, max_mb - used_mb)
    usage_pct = (used_mb / max_mb * 100) if max_mb > 0 else 0.0

    return StorageQuotaInfo(
        max_size_mb=max_mb,
        used_size_mb=used_mb,
        remaining_mb=round(remaining, 2),
        usage_percent=round(usage_pct, 2),
    )


# ========== Space CRUD ==========

@router.post("", response_model=SpaceResponse, status_code=status.HTTP_201_CREATED)
def create_space(
    space_in: SpaceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.can_create_spaces and not current_user.is_root:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="您没有创建私密空间的权限，请联系管理员。"
        )
    space = Space(
        name=space_in.name,
        type=space_in.type,
        description=space_in.description,
        cover_url=space_in.cover_url,
        created_by=current_user.id,
    )
    db.add(space)
    db.flush()  # Get space.id

    # Creator becomes owner
    owner_member = SpaceMember(
        space_id=space.id,
        user_id=current_user.id,
        role=SpaceMemberRole.OWNER,
    )
    db.add(owner_member)
    db.commit()
    db.refresh(space)
    return build_space_response(space)


@router.get("", response_model=List[SpaceResponse])
def list_my_spaces(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Return all spaces where the user is a member
    memberships = db.scalars(
        select(SpaceMember).where(SpaceMember.user_id == current_user.id)
    ).all()
    space_ids = [m.space_id for m in memberships]
    if not space_ids:
        return []

    spaces = db.scalars(
        select(Space).where(Space.id.in_(space_ids)).order_by(Space.created_at.desc())
    ).all()
    return [build_space_response(s) for s in spaces]


@router.get("/{space_id}", response_model=SpaceDetailResponse)
def get_space(
    space_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    space = get_space_or_404(db, space_id)
    require_membership(db, space_id, current_user.id)

    members_resp = [build_member_response(m) for m in space.members]
    return SpaceDetailResponse(
        id=space.id,
        name=space.name,
        type=space.type,
        description=space.description,
        cover_url=space.cover_url,
        created_by=space.created_by,
        created_at=space.created_at,
        member_count=len(space.members),
        members=members_resp,
    )


@router.patch("/{space_id}", response_model=SpaceResponse)
def update_space(
    space_id: int,
    space_in: SpaceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    space = get_space_or_404(db, space_id)
    require_owner(db, space_id, current_user.id)

    if space_in.name is not None:
        space.name = space_in.name
    if space_in.description is not None:
        space.description = space_in.description
    if space_in.cover_url is not None:
        space.cover_url = space_in.cover_url

    db.commit()
    db.refresh(space)
    return build_space_response(space)


@router.delete("/{space_id}")
def delete_space(
    space_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    space = get_space_or_404(db, space_id)
    require_owner(db, space_id, current_user.id)
    db.delete(space)
    db.commit()
    return {"status": "ok", "message": "空间已成功删除。"}


# ========== Member Management ==========

@router.delete("/{space_id}/members/{user_id}")
def remove_member(
    space_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_space_or_404(db, space_id)
    owner = require_owner(db, space_id, current_user.id)

    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="所有者不能将自己移出空间。"
        )

    target_member = db.scalar(
        select(SpaceMember).where(
            SpaceMember.space_id == space_id, SpaceMember.user_id == user_id
        )
    )
    if not target_member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="该用户不在此空间中。"
        )

    db.delete(target_member)
    db.commit()
    return {"status": "ok", "message": "成员已移除。"}


# ========== Space Invites ==========

@router.post("/{space_id}/invites", response_model=SpaceInviteResponse, status_code=status.HTTP_201_CREATED)
def create_invite(
    space_id: int,
    invite_in: SpaceInviteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_space_or_404(db, space_id)
    require_owner(db, space_id, current_user.id)

    expires_at = None
    if invite_in.expires_in_hours:
        expires_at = datetime.now(UTC).replace(tzinfo=None) + timedelta(hours=invite_in.expires_in_hours)

    invite = SpaceInvite(
        code=secrets.token_hex(16),
        space_id=space_id,
        created_by=current_user.id,
        max_uses=invite_in.max_uses,
        expires_at=expires_at,
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)
    return invite


@router.get("/{space_id}/invites", response_model=List[SpaceInviteResponse])
def list_invites(
    space_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_space_or_404(db, space_id)
    require_owner(db, space_id, current_user.id)

    invites = db.scalars(
        select(SpaceInvite)
        .where(SpaceInvite.space_id == space_id)
        .order_by(SpaceInvite.created_at.desc())
    ).all()
    return invites


@router.delete("/{space_id}/invites/{invite_id}")
def delete_invite(
    space_id: int,
    invite_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_space_or_404(db, space_id)
    require_owner(db, space_id, current_user.id)

    invite = db.scalar(
        select(SpaceInvite).where(
            SpaceInvite.id == invite_id, SpaceInvite.space_id == space_id
        )
    )
    if not invite:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="邀请码不存在。")

    db.delete(invite)
    db.commit()
    return {"status": "ok", "message": "邀请码已删除。"}


@router.post("/join", response_model=SpaceResponse)
def join_space_by_invite(
    join_in: SpaceInviteJoin,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invite = db.scalar(
        select(SpaceInvite).where(SpaceInvite.code == join_in.code)
    )
    if not invite:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="邀请码无效或不存在。")

    # Check expiration
    if invite.expires_at and invite.expires_at < datetime.now(UTC).replace(tzinfo=None):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="邀请码已过期。")

    # Check usage count
    if invite.used_count >= invite.max_uses:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="邀请码已达到最大使用次数。")

    # Check if already a member
    existing = db.scalar(
        select(SpaceMember).where(
            SpaceMember.space_id == invite.space_id,
            SpaceMember.user_id == current_user.id,
        )
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="您已经是该空间的成员。")

    # Add member
    new_member = SpaceMember(
        space_id=invite.space_id,
        user_id=current_user.id,
        role=SpaceMemberRole.MEMBER,
    )
    db.add(new_member)
    invite.used_count += 1
    db.commit()

    space = get_space_or_404(db, invite.space_id)
    return build_space_response(space)


# ========== Storage Quota ==========

@router.get("/storage/quota", response_model=StorageQuotaInfo)
def get_quota(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_storage_quota_info(db)
