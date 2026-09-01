from datetime import UTC, datetime, timedelta

from app.models.blog import BlogCategory, BlogPost
from app.models.user import User
from app.routers.blog import list_public_posts_page
from app.services.auth import hash_password


def test_public_blog_page_paginates_and_searches_within_category(db):
    author = User(
        username="page-writer",
        email="page-writer@example.com",
        password=hash_password("password123"),
        display_name="Page Writer",
        is_active=True,
    )
    category = BlogCategory(name="Agent", slug="agent")
    other_category = BlogCategory(name="Reading", slug="reading")
    db.add_all([author, category, other_category])
    db.flush()

    now = datetime.now(UTC).replace(tzinfo=None)
    for index in range(12):
        db.add(
            BlogPost(
                title=f"Agent note {index}",
                slug=f"agent-note-{index}",
                content="Dify workflow" if index == 0 else "General content",
                excerpt="Searchable memory" if index == 0 else None,
                author_id=author.id,
                category_id=category.id,
                is_public=True,
                is_published=True,
                is_featured=index < 2,
                published_at=now - timedelta(minutes=index),
            )
        )
    db.add(
        BlogPost(
            title="Other Dify note",
            slug="other-dify-note",
            content="Dify workflow",
            author_id=author.id,
            category_id=other_category.id,
            is_public=True,
            is_published=True,
            published_at=now,
        )
    )
    db.add(
        BlogPost(
            title="Deleted Dify note",
            slug="deleted-dify-note",
            content="Dify workflow",
            author_id=author.id,
            category_id=category.id,
            is_public=True,
            is_published=True,
            deleted_at=now,
            published_at=now,
        )
    )
    db.commit()

    first_page = list_public_posts_page(
        category="agent",
        q=None,
        page=1,
        page_size=9,
        db=db,
    )
    assert first_page.total == 10
    assert first_page.pages == 2
    assert len(first_page.items) == 9
    assert all(not post.is_featured for post in first_page.items)

    second_page = list_public_posts_page(
        category="agent",
        q=None,
        page=2,
        page_size=9,
        db=db,
    )
    assert len(second_page.items) == 1

    searched = list_public_posts_page(
        category="agent",
        q="Dify",
        page=1,
        page_size=9,
        db=db,
    )
    assert searched.total == 1
    assert searched.items[0].slug == "agent-note-0"
