import mimetypes
import os
import re
import shutil
import tempfile
import uuid
import zipfile
from datetime import UTC, datetime
from typing import List

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    Response,
    UploadFile,
    status,
)
from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import require_blog_writer, require_root
from app.models.blog import BlogCategory, BlogPost
from app.models.user import User
from app.services.upload import upload_file_to_lsky
from app.schemas.blog import (
    BlogCategoryCreate,
    BlogCategoryResponse,
    BlogCategoryUpdate,
    BlogPostCreate,
    BlogPostListItemResponse,
    BlogPostPageResponse,
    BlogPostResponse,
    BlogPostUpdate,
)

router = APIRouter(tags=["blog"])
FEATURED_DISPLAY_LIMIT = 4
MAX_FEATURED_POSTS_PER_CATEGORY = 4


def pick_featured_posts(
    posts: List[BlogPost],
    limit: int = FEATURED_DISPLAY_LIMIT,
) -> List[BlogPost]:
    """Prefer the newest post from each category, then fill by recency."""
    selected: List[BlogPost] = []
    selected_ids: set[int] = set()
    seen_categories: set[int | None] = set()

    for post in posts:
        category_key = post.category_id
        if category_key in seen_categories:
            continue
        selected.append(post)
        selected_ids.add(post.id)
        seen_categories.add(category_key)
        if len(selected) == limit:
            return selected

    for post in posts:
        if post.id in selected_ids:
            continue
        selected.append(post)
        if len(selected) == limit:
            break
    return selected


def ensure_featured_capacity(db: Session, post: BlogPost) -> None:
    category_filter = (
        BlogPost.category_id.is_(None)
        if post.category_id is None
        else BlogPost.category_id == post.category_id
    )
    featured_count = (
        db.scalar(
            select(func.count(BlogPost.id)).where(
                BlogPost.is_featured == True,
                BlogPost.id != post.id,
                category_filter,
            )
        )
        or 0
    )
    if featured_count >= MAX_FEATURED_POSTS_PER_CATEGORY:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"每个技术分区（含未分类）最多保留 {MAX_FEATURED_POSTS_PER_CATEGORY} 篇精选文章。",
        )


def get_category_or_404(db: Session, category_id: int | None) -> BlogCategory | None:
    if category_id is None:
        return None
    category = db.get(BlogCategory, category_id)
    if not category:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="博客分区不存在。")
    return category


def build_category_slug(db: Session, name: str, supplied_slug: str | None) -> str:
    """Keep the internal URL identifier out of the normal category workflow."""
    source = (supplied_slug or name).strip().lower()
    candidate = re.sub(r"[^a-z0-9]+", "-", source).strip("-")[:90]
    if not candidate:
        candidate = "category"

    slug = candidate
    while db.scalar(select(BlogCategory.id).where(BlogCategory.slug == slug)):
        slug = f"{candidate[:80]}-{uuid.uuid4().hex[:8]}"
    return slug


def ensure_post_manager(post: BlogPost, current_user: User) -> None:
    if not current_user.is_root and post.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="只能管理自己的博客文章。"
        )


def ensure_private_preview_owner(post: BlogPost, current_user: User) -> None:
    """Allow the author, or a root user, to read a private preview."""
    if not current_user.is_root and post.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="只能预览自己创作的博客文章。"
        )


def build_post(
    post_in: BlogPostCreate,
    current_user: User,
    db: Session,
) -> BlogPost:
    existing = db.scalar(select(BlogPost).where(BlogPost.slug == post_in.slug))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="标识链接 (Slug) 已存在，请换一个唯一的标识链接。",
        )

    get_category_or_404(db, post_in.category_id)
    published_at = datetime.now(UTC).replace(tzinfo=None) if post_in.is_published else None
    return BlogPost(
        title=post_in.title,
        slug=post_in.slug,
        content=post_in.content,
        cover_url=post_in.cover_url,
        excerpt=post_in.excerpt,
        is_public=post_in.is_public,
        is_published=post_in.is_published,
        tags=post_in.tags,
        category_id=post_in.category_id,
        author_id=current_user.id,
        published_at=published_at,
    )


def get_published_post_or_404(slug: str, db: Session) -> BlogPost:
    post = db.scalar(
        select(BlogPost)
        .options(joinedload(BlogPost.author), joinedload(BlogPost.category))
        .where(
            BlogPost.slug == slug,
            BlogPost.is_public.is_(True),
            BlogPost.is_published.is_(True),
        )
    )
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文章未找到或未公开。")
    return post


# ========== PUBLIC ROUTE ==========


@router.get("/api/blog/categories", response_model=List[BlogCategoryResponse])
@router.get("/api/public/blog/categories", response_model=List[BlogCategoryResponse])
def list_public_categories(db: Session = Depends(get_db)):
    return db.scalars(
        select(BlogCategory).order_by(BlogCategory.sort_order, BlogCategory.name)
    ).all()


@router.get("/api/blog/posts", response_model=List[BlogPostResponse])
def list_public_posts(category: str | None = Query(None), db: Session = Depends(get_db)):
    statement = (
        select(BlogPost)
        .options(joinedload(BlogPost.author), joinedload(BlogPost.category))
        .where(BlogPost.is_public == True, BlogPost.is_published == True)
        .order_by(BlogPost.published_at.desc())
    )
    if category:
        statement = statement.join(BlogPost.category).where(BlogCategory.slug == category)
    posts = db.scalars(statement).all()
    return posts


@router.get("/api/blog/featured", response_model=List[BlogPostResponse])
@router.get("/api/public/blog/featured", response_model=List[BlogPostListItemResponse])
def list_featured_posts(
    category: str | None = Query(None),
    db: Session = Depends(get_db),
):
    statement = (
        select(BlogPost)
        .options(joinedload(BlogPost.author), joinedload(BlogPost.category))
        .where(
            BlogPost.is_featured == True,
            BlogPost.is_public.is_(True),
            BlogPost.is_published.is_(True),
        )
        .order_by(BlogPost.published_at.desc(), BlogPost.id.desc())
    )
    if category:
        statement = (
            statement.join(BlogPost.category)
            .where(BlogCategory.slug == category)
            .limit(FEATURED_DISPLAY_LIMIT)
        )
        return db.scalars(statement).all()

    posts = db.scalars(statement).all()
    return pick_featured_posts(posts)


@router.get("/api/blog/posts-page", response_model=BlogPostPageResponse)
@router.get("/api/public/blog/posts-page", response_model=BlogPostPageResponse)
def list_public_posts_page(
    category: str | None = Query(None),
    q: str | None = Query(None, max_length=100),
    page: int = Query(1, ge=1),
    page_size: int = Query(9, ge=1, le=24),
    db: Session = Depends(get_db),
):
    filters = [
        BlogPost.is_public == True,
        BlogPost.is_published == True,
    ]
    search = q.strip() if q else ""
    if search:
        pattern = f"%{search}%"
        filters.append(
            or_(
                BlogPost.title.ilike(pattern),
                BlogPost.excerpt.ilike(pattern),
                BlogPost.content.ilike(pattern),
            )
        )
    else:
        featured_ids = [post.id for post in list_featured_posts(category=category, db=db)]
        if featured_ids:
            filters.append(BlogPost.id.notin_(featured_ids))

    count_statement = select(func.count(BlogPost.id)).where(*filters)
    item_statement = (
        select(BlogPost)
        .options(joinedload(BlogPost.author), joinedload(BlogPost.category))
        .where(*filters)
    )
    if category:
        count_statement = count_statement.join(BlogPost.category).where(
            BlogCategory.slug == category
        )
        item_statement = item_statement.join(BlogPost.category).where(BlogCategory.slug == category)

    total = db.scalar(count_statement) or 0
    pages = max(1, (total + page_size - 1) // page_size)
    items = db.scalars(
        item_statement.order_by(BlogPost.published_at.desc(), BlogPost.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return BlogPostPageResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.get("/api/public/blog/posts/{slug}", response_model=BlogPostResponse)
def get_cacheable_public_post_by_slug(slug: str, db: Session = Depends(get_db)):
    """Read a published article without mutating state so ESA can cache it."""
    return get_published_post_or_404(slug, db)


@router.get("/api/blog/posts/{slug}", response_model=BlogPostResponse)
def get_public_post_by_slug(slug: str, db: Session = Depends(get_db)):
    """Backward-compatible detail endpoint that retains the legacy view increment."""
    post = get_published_post_or_404(slug, db)
    post.view_count += 1
    db.commit()
    db.refresh(post)
    return post


@router.post("/api/blog/posts/{slug}/view", status_code=status.HTTP_204_NO_CONTENT)
def record_public_post_view(slug: str, db: Session = Depends(get_db)):
    """Increment views explicitly without coupling a database write to article reads."""
    result = db.execute(
        update(BlogPost)
        .where(
            BlogPost.slug == slug,
            BlogPost.is_public == True,
            BlogPost.is_published == True,
        )
        .values(view_count=BlogPost.view_count + 1)
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文章未找到或未公开。")
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ========== BLOG WRITER ROUTES ==========


@router.get("/api/blog/me/posts", response_model=List[BlogPostResponse])
def list_my_posts(
    current_user: User = Depends(require_blog_writer),
    db: Session = Depends(get_db),
):
    statement = (
        select(BlogPost)
        .options(joinedload(BlogPost.author), joinedload(BlogPost.category))
        .order_by(BlogPost.created_at.desc())
    )
    if not current_user.is_root:
        statement = statement.where(BlogPost.author_id == current_user.id)
    return db.scalars(statement).all()


@router.get("/api/blog/me/posts/{post_id}/preview", response_model=BlogPostResponse)
def preview_my_post(
    post_id: int,
    current_user: User = Depends(require_blog_writer),
    db: Session = Depends(get_db),
):
    """Return a post for its author without changing publication state or views."""
    post = db.scalar(
        select(BlogPost)
        .options(joinedload(BlogPost.author), joinedload(BlogPost.category))
        .where(BlogPost.id == post_id)
    )
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文章不存在。")
    ensure_private_preview_owner(post, current_user)
    return post


@router.post(
    "/api/blog/me/posts", response_model=BlogPostResponse, status_code=status.HTTP_201_CREATED
)
def create_my_post(
    post_in: BlogPostCreate,
    current_user: User = Depends(require_blog_writer),
    db: Session = Depends(get_db),
):
    post = build_post(post_in, current_user, db)
    db.add(post)
    db.commit()
    return db.scalar(
        select(BlogPost)
        .options(joinedload(BlogPost.author), joinedload(BlogPost.category))
        .where(BlogPost.id == post.id)
    )


@router.patch("/api/blog/me/posts/{post_id}", response_model=BlogPostResponse)
def update_my_post(
    post_id: int,
    post_in: BlogPostUpdate,
    current_user: User = Depends(require_blog_writer),
    db: Session = Depends(get_db),
):
    post = db.scalar(
        select(BlogPost)
        .options(joinedload(BlogPost.author), joinedload(BlogPost.category))
        .where(BlogPost.id == post_id)
    )
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文章不存在。")
    ensure_post_manager(post, current_user)
    if "is_featured" in post_in.model_fields_set and not current_user.is_root:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="只有超级管理员可以设置精选文章。"
        )
    return apply_post_update(post, post_in, db)


@router.delete("/api/blog/me/posts/{post_id}")
def delete_my_post(
    post_id: int,
    current_user: User = Depends(require_blog_writer),
    db: Session = Depends(get_db),
):
    post = db.get(BlogPost, post_id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文章不存在。")
    ensure_post_manager(post, current_user)
    db.delete(post)
    db.commit()
    return {"status": "ok", "message": "文章已成功删除。"}


# ========== ADMIN ROUTE ==========


@router.get("/api/admin/blog/categories", response_model=List[BlogCategoryResponse])
def list_admin_categories(
    db: Session = Depends(get_db), current_user: User = Depends(require_root)
):
    return db.scalars(
        select(BlogCategory).order_by(BlogCategory.sort_order, BlogCategory.name)
    ).all()


@router.post(
    "/api/admin/blog/categories",
    response_model=BlogCategoryResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_category(
    category_in: BlogCategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_root),
):
    existing = db.scalar(select(BlogCategory).where(BlogCategory.name == category_in.name))
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="分区名称已存在。")
    category = BlogCategory(
        **category_in.model_dump(exclude={"slug"}),
        slug=build_category_slug(db, category_in.name, category_in.slug),
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.patch("/api/admin/blog/categories/{category_id}", response_model=BlogCategoryResponse)
def update_category(
    category_id: int,
    category_in: BlogCategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_root),
):
    category = db.get(BlogCategory, category_id)
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="博客分区不存在。")
    changes = category_in.model_dump(exclude_unset=True)
    if "name" in changes or "slug" in changes:
        existing = db.scalar(
            select(BlogCategory).where(
                BlogCategory.id != category_id,
                (
                    (BlogCategory.name == changes.get("name", category.name))
                    | (BlogCategory.slug == changes.get("slug", category.slug))
                ),
            )
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="分区名称或标识已存在。"
            )
    for key, value in changes.items():
        setattr(category, key, value)
    db.commit()
    db.refresh(category)
    return category


@router.delete("/api/admin/blog/categories/{category_id}")
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_root),
):
    category = db.get(BlogCategory, category_id)
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="博客分区不存在。")
    for post in category.posts:
        post.category_id = None
    db.delete(category)
    db.commit()
    return {"status": "ok", "message": "博客分区已删除，原文章已归入未分类。"}


@router.get(
    "/api/admin/blog/posts",
    response_model=List[BlogPostResponse],
    dependencies=[Depends(require_root)],
)
def list_admin_posts(db: Session = Depends(get_db)):
    posts = db.scalars(
        select(BlogPost)
        .options(joinedload(BlogPost.author), joinedload(BlogPost.category))
        .order_by(BlogPost.created_at.desc())
    ).all()
    return posts


@router.post(
    "/api/admin/blog/posts", response_model=BlogPostResponse, status_code=status.HTTP_201_CREATED
)
def create_admin_post(
    post_in: BlogPostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_root),
):
    post = build_post(post_in, current_user, db)
    db.add(post)
    db.commit()
    db.refresh(post)

    # Reload with author relationship loaded
    return db.scalar(
        select(BlogPost)
        .options(joinedload(BlogPost.author), joinedload(BlogPost.category))
        .where(BlogPost.id == post.id)
    )


@router.patch("/api/admin/blog/posts/{post_id}", response_model=BlogPostResponse)
def update_admin_post(
    post_id: int,
    post_in: BlogPostUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_root),
):
    post = db.scalar(
        select(BlogPost).options(joinedload(BlogPost.author)).where(BlogPost.id == post_id)
    )
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文章不存在。")

    return apply_post_update(post, post_in, db)


def apply_post_update(post: BlogPost, post_in: BlogPostUpdate, db: Session) -> BlogPost:
    # Check slug uniqueness if it is changing
    if post_in.slug is not None and post_in.slug != post.slug:
        existing = db.scalar(
            select(BlogPost).where(BlogPost.slug == post_in.slug, BlogPost.id != post.id)
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="标识链接 (Slug) 已被其他文章占用，请重新输入。",
            )

    # Apply updates
    if post_in.title is not None:
        post.title = post_in.title
    if post_in.slug is not None:
        post.slug = post_in.slug
    if post_in.content is not None:
        post.content = post_in.content
    if "cover_url" in post_in.model_fields_set:
        post.cover_url = post_in.cover_url
    if "excerpt" in post_in.model_fields_set:
        post.excerpt = post_in.excerpt
    if post_in.tags is not None:
        post.tags = post_in.tags
    if "category_id" in post_in.model_fields_set:
        get_category_or_404(db, post_in.category_id)
        post.category_id = post_in.category_id
    if post_in.is_public is not None:
        post.is_public = post_in.is_public

    if post_in.is_published is not None:
        # transition from draft to published
        if post_in.is_published and not post.is_published:
            if not post.published_at:
                post.published_at = datetime.now(UTC).replace(tzinfo=None)
        post.is_published = post_in.is_published

    if "is_featured" in post_in.model_fields_set:
        if post_in.is_featured and (not post.is_public or not post.is_published):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="只有已公开发布的文章可以设为精选。",
            )
        post.is_featured = bool(post_in.is_featured)

    if not post.is_public or not post.is_published:
        post.is_featured = False
    if post.is_featured:
        ensure_featured_capacity(db, post)

    db.commit()
    db.refresh(post)
    return post


@router.delete("/api/admin/blog/posts/{post_id}")
def delete_admin_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_root),
):
    post = db.scalar(select(BlogPost).where(BlogPost.id == post_id))
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文章不存在。")

    db.delete(post)
    db.commit()
    return {"status": "ok", "message": "文章已成功删除。"}


@router.post("/api/admin/blog/parse-markdown")
async def parse_markdown_blog(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_blog_writer),
):
    filename_lower = file.filename.lower()
    if (
        not filename_lower.endswith(".md")
        and not filename_lower.endswith(".markdown")
        and not filename_lower.endswith(".zip")
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="只能上传 Markdown (.md) 格式或包含 Markdown 的 .zip 压缩包。",
        )

    content_str = ""

    if filename_lower.endswith(".zip"):
        temp_dir = tempfile.mkdtemp()
        zip_path = os.path.join(temp_dir, "temp.zip")
        try:
            # Save zip content
            contents = await file.read()
            with open(zip_path, "wb") as f:
                f.write(contents)

            # Extract
            with zipfile.ZipFile(zip_path, "r") as zip_ref:
                zip_ref.extractall(temp_dir)

            # Find markdown file
            md_file_path = None
            for root, dirs, files_in_dir in os.walk(temp_dir):
                for f in files_in_dir:
                    if f.lower().endswith((".md", ".markdown")) and f != "temp.zip":
                        md_file_path = os.path.join(root, f)
                        break
                if md_file_path:
                    break

            if not md_file_path:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="未在 ZIP 压缩包中找到任何 Markdown (.md) 文件。",
                )

            # Read markdown
            with open(md_file_path, "rb") as f:
                md_contents = f.read()

            try:
                content_str = md_contents.decode("utf-8")
            except UnicodeDecodeError:
                try:
                    content_str = md_contents.decode("gbk")
                except UnicodeDecodeError:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="无法解析 Markdown 文件编码，请确保文件保存为 UTF-8 编码。",
                    )

            # Find all image links: ![alt](path)
            img_pattern = r"!\[(.*?)\]\((.*?)\)"
            matches = re.findall(img_pattern, content_str)

            md_dir = os.path.dirname(md_file_path)
            replacements = {}

            for alt_text, img_path in matches:
                img_path_clean = img_path.strip()
                if img_path_clean.startswith(("http://", "https://", "data:")):
                    continue

                # Resolve relative path inside zip structure
                resolved_img_path = os.path.normpath(os.path.join(md_dir, img_path_clean))
                # Ensure safety (stay within temp_dir)
                if (
                    resolved_img_path.startswith(temp_dir)
                    and os.path.exists(resolved_img_path)
                    and os.path.isfile(resolved_img_path)
                ):
                    mime_type, _ = mimetypes.guess_type(resolved_img_path)
                    if not mime_type:
                        mime_type = "image/png"

                    with open(resolved_img_path, "rb") as img_file:
                        img_bytes = img_file.read()

                    img_name = os.path.basename(resolved_img_path)
                    try:
                        url = await upload_file_to_lsky(img_name, img_bytes, mime_type, db)
                        replacements[img_path] = url
                    except Exception as e:
                        print(f"Failed to upload image {img_name} in zip: {e}")

            # Replace local links
            for local_path, remote_url in replacements.items():
                content_str = content_str.replace(f"({local_path})", f"({remote_url})")

        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)

    else:
        contents = await file.read()
        try:
            content_str = contents.decode("utf-8")
        except UnicodeDecodeError:
            try:
                content_str = contents.decode("gbk")
            except UnicodeDecodeError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="无法解析文件编码，请确保文件保存为 UTF-8 编码。",
                )

    # 默认值
    meta = {"title": "", "slug": "", "cover_url": None, "excerpt": None, "tags": None}
    body = content_str

    # 检查是否以 --- 开头
    pattern = r"^\s*---\s*\n(.*?)\n\s*---\s*\n(.*)"
    match = re.match(pattern, content_str, re.DOTALL)
    if match:
        front_matter = match.group(1)
        body = match.group(2)

        for line in front_matter.split("\n"):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if ":" in line:
                key, val = line.split(":", 1)
                key = key.strip().lower()
                val = val.strip()

                if (val.startswith('"') and val.endswith('"')) or (
                    val.startswith("'") and val.endswith("'")
                ):
                    val = val[1:-1]

                if key == "title":
                    meta["title"] = val
                elif key == "slug":
                    meta["slug"] = val
                elif key == "cover_url":
                    meta["cover_url"] = val
                elif key == "excerpt":
                    meta["excerpt"] = val
                elif key == "tags":
                    if val.startswith("[") and val.endswith("]"):
                        val = val[1:-1]
                    tags_list = [t.strip() for t in val.split(",") if t.strip()]
                    meta["tags"] = tags_list
    else:
        lines = [l.strip() for l in content_str.split("\n") if l.strip()]
        if lines:
            first_line = lines[0]
            if first_line.startswith("#"):
                meta["title"] = first_line.lstrip("#").strip()
            else:
                meta["title"] = first_line
            meta["slug"] = f"post-{uuid.uuid4().hex[:8]}"

    return {"meta": meta, "content": body}
