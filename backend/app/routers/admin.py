import secrets
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_root
from app.models.invite_code import InviteCode
from app.models.storage_quota import StorageQuota
from app.models.system_config import SystemConfig
from app.models.user import User
from app.schemas.admin import (
    InviteCodeCreate,
    InviteCodeResponse,
    StorageQuotaResponse,
    StorageQuotaUpdate,
    SystemConfigResponse,
    SystemConfigUpdate,
    UserStatusUpdate,
)
from app.schemas.user import UserResponse
from app.utils.crypto import decrypt_value, encrypt_value

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_root)])

SENSITIVE_CONFIG_KEYS = {
    "qwen_api_key",
    "deepseek_api_key",
    "lsky_api_token",
}


def mask_secret(value: str) -> str:
    if not value:
        return ""
    if len(value) <= 8:
        return "****"
    return f"{value[:4]}****{value[-4:]}"


@router.get("/users", response_model=list[UserResponse])
def list_users(db: Session = Depends(get_db)):
    users = db.scalars(select(User).order_by(User.id.desc())).all()
    return users


@router.patch("/users/{user_id}", response_model=UserResponse)
def update_user_status(user_id: int, status_in: UserStatusUpdate, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在。")
    if user.is_root:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="不能禁用超级管理员账号。"
        )

    user.is_active = status_in.is_active
    db.commit()
    db.refresh(user)
    return user


@router.get("/configs", response_model=list[SystemConfigResponse])
def list_configs(db: Session = Depends(get_db)):
    configs = db.scalars(select(SystemConfig).order_by(SystemConfig.id.asc())).all()

    # Mask sensitive credentials
    response_configs = []
    for conf in configs:
        val = conf.config_val
        if conf.config_key in SENSITIVE_CONFIG_KEYS and val:
            decrypted = decrypt_value(val)
            val = mask_secret(decrypted)

        response_configs.append(
            SystemConfigResponse(
                id=conf.id,
                config_key=conf.config_key,
                config_val=val,
                description=conf.description,
                updated_at=conf.updated_at,
            )
        )
    return response_configs


@router.patch("/configs/{key}", response_model=SystemConfigResponse)
def update_config(
    key: str,
    config_in: SystemConfigUpdate,
    current_user: User = Depends(require_root),
    db: Session = Depends(get_db),
):
    config = db.scalar(select(SystemConfig).where(SystemConfig.config_key == key))
    if not config:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="配置项不存在。")

    val_to_save = config_in.config_val
    if key in SENSITIVE_CONFIG_KEYS and val_to_save:
        val_to_save = encrypt_value(val_to_save)

    config.config_val = val_to_save
    config.updated_by = current_user.id
    db.commit()
    db.refresh(config)

    # Return masked value in response
    return_val = config_in.config_val
    if key in SENSITIVE_CONFIG_KEYS and return_val:
        return_val = mask_secret(return_val)

    return SystemConfigResponse(
        id=config.id,
        config_key=config.config_key,
        config_val=return_val,
        description=config.description,
        updated_at=config.updated_at,
    )


@router.post(
    "/invite-codes", response_model=InviteCodeResponse, status_code=status.HTTP_201_CREATED
)
def create_invite_code(
    code_in: InviteCodeCreate,
    current_user: User = Depends(require_root),
    db: Session = Depends(get_db),
):
    expires_at = None
    if code_in.expires_in_hours:
        expires_at = datetime.now(UTC).replace(tzinfo=None) + timedelta(
            hours=code_in.expires_in_hours
        )

    db_code = InviteCode(
        code=secrets.token_hex(16),  # 32 characters hex string
        created_by=current_user.id,
        expires_at=expires_at,
    )
    db.add(db_code)
    db.commit()
    db.refresh(db_code)
    return db_code


@router.get("/invite-codes", response_model=list[InviteCodeResponse])
def list_invite_codes(db: Session = Depends(get_db)):
    codes = db.scalars(select(InviteCode).order_by(InviteCode.id.desc())).all()
    return codes


@router.get("/storage-quota", response_model=StorageQuotaResponse)
def get_storage_quota(db: Session = Depends(get_db)):
    quota = db.scalar(select(StorageQuota))
    if not quota:
        # Auto initialize if empty
        quota = StorageQuota(max_size_mb=1024.0, used_size_mb=0.0)
        db.add(quota)
        db.commit()
        db.refresh(quota)
    return quota


@router.patch("/storage-quota", response_model=StorageQuotaResponse)
def update_storage_quota(quota_in: StorageQuotaUpdate, db: Session = Depends(get_db)):
    quota = db.scalar(select(StorageQuota))
    if not quota:
        quota = StorageQuota(max_size_mb=quota_in.max_size_mb, used_size_mb=0.0)
        db.add(quota)
    else:
        quota.max_size_mb = quota_in.max_size_mb

    db.commit()
    db.refresh(quota)
    return quota
