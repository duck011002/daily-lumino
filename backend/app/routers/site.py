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
public_cache_router = APIRouter(prefix="/api/public", tags=["public-site"])
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


def load_site_profile(db: Session, *, for_update: bool = False) -> SiteProfile:
    query = select(SystemConfig).where(SystemConfig.config_key == PROFILE_CONFIG_KEY)
    if for_update:
        query = query.with_for_update()
    config = db.scalar(query)
    if not config or not config.config_val:
        return default_site_profile()
    try:
        return SiteProfile.model_validate_json(config.config_val)
    except (ValueError, TypeError):
        return default_site_profile()


def save_site_profile(
    db: Session,
    profile: SiteProfile,
    updated_by: int,
    *,
    commit: bool = True,
) -> SiteProfile:
    config = db.scalar(
        select(SystemConfig)
        .where(SystemConfig.config_key == PROFILE_CONFIG_KEY)
        .with_for_update()
    )
    if not config:
        config = SystemConfig(
            config_key=PROFILE_CONFIG_KEY,
            description="公开个人资料与书房收藏卡片",
        )
        db.add(config)
    config.config_val = json.dumps(
        profile.model_dump(mode="json"), ensure_ascii=False, separators=(",", ":")
    )
    config.updated_by = updated_by
    if commit:
        db.commit()
    else:
        db.flush()
    return profile


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
@public_cache_router.get("/site-profile", response_model=SiteProfile)
def get_public_site_profile(db: Session = Depends(get_db)):
    return public_site_profile(load_site_profile(db))


@public_router.get("/daily-digest")
def get_daily_digest(db: Session = Depends(get_db)):
    from app.models.blog import BlogPost
    posts = db.scalars(
        select(BlogPost)
        .where(BlogPost.is_published == True)
        .order_by(BlogPost.published_at.desc())
        .limit(3)
    ).all()
    if not posts:
        return {
            "title": "Lumino 数字花园每日导读",
            "summary": "欢迎来到 Lumino 数字花园。这里记录了关于技术实践、深度思考与日常随笔的精选文章。",
            "tags": ["数字花园", "技术思考", "随笔"],
            "generated_at": "今日最新",
        }
    
    titles = [p.title for p in posts]
    summary = f"今日精选推荐：包含了《{titles[0]}》"
    if len(titles) > 1:
        summary += f"以及《{titles[1]}》等技术与生活深度探讨。"
    else:
        summary += "的深度探讨与实践记录。"
        
    return {
        "title": "Lumino AI 每日博客简报",
        "summary": summary,
        "tags": ["精选文章", "技术探索", "每日导读"],
        "generated_at": "今日最新",
    }


@admin_router.get("/site-profile", response_model=SiteProfile)
def get_admin_site_profile(db: Session = Depends(get_db)):
    return load_site_profile(db)


@admin_router.put("/site-profile", response_model=SiteProfile)
def update_admin_site_profile(
    profile_in: SiteProfile,
    current_user: User = Depends(require_root),
    db: Session = Depends(get_db),
):
    return save_site_profile(db, profile_in, current_user.id)
