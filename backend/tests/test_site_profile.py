from sqlalchemy import select

from app.models.system_config import SystemConfig
from app.models.user import User
from app.routers.site import (
    get_admin_site_profile,
    get_public_site_profile,
    update_admin_site_profile,
)
from app.schemas.site import SiteMediaCard, SiteProfile, SiteProfileLink
from app.services.auth import hash_password


def test_site_profile_persists_utf8_and_filters_private_items(db):
    root = User(
        username="profile-root",
        email="profile-root@example.com",
        password=hash_password("password123"),
        display_name="Profile Root",
        is_root=True,
        is_active=True,
    )
    db.add(root)
    db.commit()

    profile = SiteProfile(
        display_name="庭院主人",
        headline="技术与生活，都值得认真记录",
        bio="一段公开简介。",
        interest_tags=["开发者", "阅读"],
        github_url="https://github.com/example",
        email="public@example.com",
        show_email=False,
        status_text="正在整理新的文章。",
        status_public=False,
        links=[
            SiteProfileLink(
                id="public-link",
                label="公开链接",
                url="https://example.com/public",
                is_public=True,
            ),
            SiteProfileLink(
                id="private-link",
                label="隐藏链接",
                url="https://example.com/private",
                is_public=False,
            ),
        ],
        media_cards=[
            SiteMediaCard(
                id="public-book",
                category="book",
                title="公开书籍",
                creator="公开作者",
                year="2026",
                badge="反复重读",
                is_public=True,
                is_featured=True,
            ),
            SiteMediaCard(
                id="private-movie",
                category="movie",
                title="隐藏电影",
                is_public=False,
            ),
        ],
    )

    saved = update_admin_site_profile(profile, current_user=root, db=db)
    assert saved.display_name == "庭院主人"

    stored = db.scalar(
        select(SystemConfig).where(
            SystemConfig.config_key == "public_site_profile"
        )
    )
    assert stored is not None
    assert "庭院主人" in stored.config_val
    assert "\\u5ead" not in stored.config_val

    admin_profile = get_admin_site_profile(db=db)
    assert len(admin_profile.links) == 2
    assert len(admin_profile.media_cards) == 2

    public_profile = get_public_site_profile(db=db)
    assert public_profile.email is None
    assert public_profile.status_text is None
    assert [item.id for item in public_profile.links] == ["public-link"]
    assert [item.id for item in public_profile.media_cards] == ["public-book"]
    assert public_profile.media_cards[0].creator == "公开作者"
    assert public_profile.media_cards[0].year == "2026"
    assert public_profile.media_cards[0].badge == "反复重读"
    assert public_profile.media_cards[0].is_featured is True
