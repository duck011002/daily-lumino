import json

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_root
from app.models.system_config import SystemConfig
from app.models.user import User
from app.schemas.site import SiteProfile


PROFILE_CONFIG_KEY = "public_site_profile"

public_router = APIRouter(prefix="/api/site", tags=["site"])
admin_router = APIRouter(
    prefix="/api/admin",
    tags=["admin-site"],
    dependencies=[Depends(require_root)],
)


def default_site_profile() -> SiteProfile:
    return SiteProfile(
        display_name="Lumino",
        headline="开发者，也在认真收藏生活",
        bio="这里是我的个人数字庭院：记录技术实践，也保存阅读、影像与日常片段。",
        interest_tags=["技术实践", "阅读", "生活记录"],
    )


def load_site_profile(db: Session) -> SiteProfile:
    config = db.scalar(
        select(SystemConfig).where(SystemConfig.config_key == PROFILE_CONFIG_KEY)
    )
    if not config or not config.config_val:
        return default_site_profile()
    try:
        return SiteProfile.model_validate_json(config.config_val)
    except (ValueError, TypeError):
        return default_site_profile()


def public_site_profile(profile: SiteProfile) -> SiteProfile:
    return profile.model_copy(
        update={
            "email": profile.email if profile.show_email else None,
            "status_text": profile.status_text if profile.status_public else None,
            "links": sorted(
                (item for item in profile.links if item.is_public),
                key=lambda item: (item.sort_order, item.label),
            ),
            "media_cards": sorted(
                (item for item in profile.media_cards if item.is_public),
                key=lambda item: (item.sort_order, item.title),
            ),
        }
    )


@public_router.get("/profile", response_model=SiteProfile)
def get_public_site_profile(db: Session = Depends(get_db)):
    return public_site_profile(load_site_profile(db))


@admin_router.get("/site-profile", response_model=SiteProfile)
def get_admin_site_profile(db: Session = Depends(get_db)):
    return load_site_profile(db)


@admin_router.put("/site-profile", response_model=SiteProfile)
def update_admin_site_profile(
    profile_in: SiteProfile,
    current_user: User = Depends(require_root),
    db: Session = Depends(get_db),
):
    config = db.scalar(
        select(SystemConfig).where(SystemConfig.config_key == PROFILE_CONFIG_KEY)
    )
    if not config:
        config = SystemConfig(
            config_key=PROFILE_CONFIG_KEY,
            description="公开个人资料与书房收藏卡片",
        )
        db.add(config)
    config.config_val = json.dumps(
        profile_in.model_dump(mode="json"),
        ensure_ascii=False,
        separators=(",", ":"),
    )
    config.updated_by = current_user.id
    db.commit()
    db.refresh(config)
    return profile_in
