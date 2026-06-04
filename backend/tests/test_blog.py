import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.models.user import User
from app.models.blog import BlogPost


@pytest.fixture
def blog_test_setup(client: TestClient, db):
    # Register and login User (non-root)
    client.post(
        "/api/auth/register",
        json={"username": "normaluser", "email": "normal@example.com", "password": "password123"},
    )
    res_normal = client.post("/api/auth/login", json={"username_or_email": "normaluser", "password": "password123"})
    normal_cookies = res_normal.cookies

    # Register Admin user
    client.post(
        "/api/auth/register",
        json={"username": "adminuser", "email": "admin@example.com", "password": "password123"},
    )
    
    # Manually upgrade adminuser to root in the database
    admin_db = db.scalar(select(User).where(User.username == "adminuser"))
    admin_db.is_root = True
    db.commit()

    # Login Admin
    res_admin = client.post("/api/auth/login", json={"username_or_email": "adminuser", "password": "password123"})
    admin_cookies = res_admin.cookies

    return {
        "normal": normal_cookies,
        "admin": admin_cookies
    }


def test_admin_blog_crud(client: TestClient, blog_test_setup, db):
    admin_cookies = blog_test_setup["admin"]

    # 1. Create a blog post
    res = client.post(
        "/api/admin/blog/posts",
        json={
            "title": "测试博客",
            "slug": "test-blog",
            "content": "博客内容",
            "cover_url": "http://cover.jpg",
            "excerpt": "摘要",
            "is_public": True,
            "is_published": False,
            "tags": ["测试", "生活"]
        },
        cookies=admin_cookies,
    )
    assert res.status_code == 201
    post_id = res.json()["id"]
    assert res.json()["title"] == "测试博客"
    assert res.json()["slug"] == "test-blog"
    assert res.json()["tags"] == ["测试", "生活"]
    assert res.json()["is_published"] is False
    assert res.json()["published_at"] is None

    # 2. Duplicate slug should fail
    res_dup = client.post(
        "/api/admin/blog/posts",
        json={
            "title": "重复博客",
            "slug": "test-blog",
            "content": "内容"
        },
        cookies=admin_cookies,
    )
    assert res_dup.status_code == 400
    assert "Slug" in res_dup.json()["detail"]

    # 3. List admin posts
    list_res = client.get("/api/admin/blog/posts", cookies=admin_cookies)
    assert list_res.status_code == 200
    assert len(list_res.json()) == 1

    # 4. Update the blog post (and publish it)
    patch_res = client.patch(
        f"/api/admin/blog/posts/{post_id}",
        json={
            "title": "修改后的博客",
            "slug": "updated-blog",
            "is_published": True
        },
        cookies=admin_cookies,
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["title"] == "修改后的博客"
    assert patch_res.json()["slug"] == "updated-blog"
    assert patch_res.json()["is_published"] is True
    assert patch_res.json()["published_at"] is not None

    # Create another post to test duplicate slug during update
    client.post(
        "/api/admin/blog/posts",
        json={"title": "另一篇", "slug": "another-blog", "content": "内容"},
        cookies=admin_cookies
    )

    # Attempt to update first post's slug to "another-blog" -> should fail
    patch_dup_res = client.patch(
        f"/api/admin/blog/posts/{post_id}",
        json={"slug": "another-blog"},
        cookies=admin_cookies,
    )
    assert patch_dup_res.status_code == 400
    assert "Slug" in patch_dup_res.json()["detail"]

    # 5. Delete post
    del_res = client.delete(f"/api/admin/blog/posts/{post_id}", cookies=admin_cookies)
    assert del_res.status_code == 200
    
    # Verify deleted in admin list
    list_res2 = client.get("/api/admin/blog/posts", cookies=admin_cookies)
    assert len(list_res2.json()) == 1  # only "另一篇" remains


def test_public_blog_access(client: TestClient, blog_test_setup, db):
    admin_cookies = blog_test_setup["admin"]

    # Create three posts:
    # 1. Public & Published
    p1 = client.post(
        "/api/admin/blog/posts",
        json={"title": "公开已发布", "slug": "public-published", "content": "正文", "is_public": True, "is_published": True},
        cookies=admin_cookies
    ).json()

    # 2. Public but draft (not published)
    p2 = client.post(
        "/api/admin/blog/posts",
        json={"title": "公开未发布", "slug": "public-draft", "content": "正文", "is_public": True, "is_published": False},
        cookies=admin_cookies
    ).json()

    # 3. Private & Published
    p3 = client.post(
        "/api/admin/blog/posts",
        json={"title": "私密已发布", "slug": "private-published", "content": "正文", "is_public": False, "is_published": True},
        cookies=admin_cookies
    ).json()

    # Visitor queries public list (no cookies needed)
    public_list = client.get("/api/blog/posts")
    assert public_list.status_code == 200
    assert len(public_list.json()) == 1
    assert public_list.json()[0]["slug"] == "public-published"

    # Visitor fetches detail of public published post
    detail_res = client.get(f"/api/blog/posts/{p1['slug']}")
    assert detail_res.status_code == 200
    assert detail_res.json()["view_count"] == 1

    # Fetch again to verify view_count increments
    detail_res2 = client.get(f"/api/blog/posts/{p1['slug']}")
    assert detail_res2.json()["view_count"] == 2

    # Visitor tries to fetch detail of draft post -> 404
    assert client.get(f"/api/blog/posts/{p2['slug']}").status_code == 404

    # Visitor tries to fetch detail of private post -> 404
    assert client.get(f"/api/blog/posts/{p3['slug']}").status_code == 404


def test_blog_access_control(client: TestClient, blog_test_setup):
    normal_cookies = blog_test_setup["normal"]

    # Try listing admin posts -> 403
    assert client.get("/api/admin/blog/posts", cookies=normal_cookies).status_code == 403

    # Try creating a post -> 403
    assert client.post(
        "/api/admin/blog/posts",
        json={"title": "越权文章", "slug": "forbidden-slug", "content": "内容"},
        cookies=normal_cookies
    ).status_code == 403

    # Try updating/deleting posts (even with fake/any id) -> 403
    assert client.patch(
        "/api/admin/blog/posts/999",
        json={"title": "尝试越权修改"},
        cookies=normal_cookies
    ).status_code == 403

    assert client.delete(
        "/api/admin/blog/posts/999",
        cookies=normal_cookies
    ).status_code == 403
