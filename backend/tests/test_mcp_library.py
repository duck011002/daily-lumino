from app.mcp_library import (
    MCPLibraryIdentity,
    current_mcp_library_identity,
    get_library_profile,
    update_library_profile,
    upsert_library_media_card,
)
from app.models.user import User
from app.routers.site import load_site_profile
from app.services.auth import hash_password


class SessionContext:
    def __init__(self, db):
        self.db = db

    def __enter__(self):
        return self.db

    def __exit__(self, *_):
        return False


def test_library_mcp_updates_profile_and_public_card_directly(db, monkeypatch):
    root = User(
        username="library-mcp-root",
        email="library-mcp@example.com",
        password=hash_password("password123"),
        display_name="Library Root",
        is_root=True,
        is_active=True,
    )
    db.add(root)
    db.commit()
    monkeypatch.setattr("app.mcp_library.SessionLocal", lambda: SessionContext(db))
    context_token = current_mcp_library_identity.set(MCPLibraryIdentity(user_id=root.id))
    try:
        updated = update_library_profile(headline="新的书房介绍", interest_tags=["阅读", "电影"])
        assert updated["headline"] == "新的书房介绍"
        card = upsert_library_media_card(
            title="测试书籍",
            category="book",
            creator="作者",
            is_public=True,
        )
        assert card["is_public"] is True
        profile = get_library_profile()
        assert profile["media_cards"][0]["title"] == "测试书籍"
        stored = load_site_profile(db)
        assert stored.headline == "新的书房介绍"
    finally:
        current_mcp_library_identity.reset(context_token)
