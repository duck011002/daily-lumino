from datetime import UTC, datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user, require_root
from app.models.blog import BlogPost
from app.models.user import User
from app.schemas.blog import BlogPostCreate, BlogPostResponse, BlogPostUpdate

router = APIRouter(tags=["blog"])


# ========== PUBLIC ROUTE ==========

@router.get("/api/blog/posts", response_model=List[BlogPostResponse])
def list_public_posts(db: Session = Depends(get_db)):
    posts = db.scalars(
        select(BlogPost)
        .options(joinedload(BlogPost.author))
        .where(BlogPost.is_public == True, BlogPost.is_published == True)
        .order_by(BlogPost.published_at.desc())
    ).all()
    return posts


@router.get("/api/blog/posts/{slug}", response_model=BlogPostResponse)
def get_public_post_by_slug(slug: str, db: Session = Depends(get_db)):
    post = db.scalar(
        select(BlogPost)
        .options(joinedload(BlogPost.author))
        .where(BlogPost.slug == slug, BlogPost.is_public == True, BlogPost.is_published == True)
    )
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="文章未找到或未公开。"
        )

    # Increment view count
    post.view_count += 1
    db.commit()
    db.refresh(post)

    return post


# ========== ADMIN ROUTE ==========

@router.get("/api/admin/blog/posts", response_model=List[BlogPostResponse], dependencies=[Depends(require_root)])
def list_admin_posts(db: Session = Depends(get_db)):
    posts = db.scalars(
        select(BlogPost)
        .options(joinedload(BlogPost.author))
        .order_by(BlogPost.created_at.desc())
    ).all()
    return posts


@router.post("/api/admin/blog/posts", response_model=BlogPostResponse, status_code=status.HTTP_201_CREATED)
def create_admin_post(
    post_in: BlogPostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_root),
):
    # Check if slug is unique
    existing = db.scalar(select(BlogPost).where(BlogPost.slug == post_in.slug))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="标识链接 (Slug) 已存在，请换一个唯一的标识链接。",
        )

    published_at = None
    if post_in.is_published:
        published_at = datetime.now(UTC).replace(tzinfo=None)

    post = BlogPost(
        title=post_in.title,
        slug=post_in.slug,
        content=post_in.content,
        cover_url=post_in.cover_url,
        excerpt=post_in.excerpt,
        is_public=post_in.is_public,
        is_published=post_in.is_published,
        tags=post_in.tags,
        author_id=current_user.id,
        published_at=published_at,
    )
    db.add(post)
    db.commit()
    db.refresh(post)

    # Reload with author relationship loaded
    return db.scalar(
        select(BlogPost)
        .options(joinedload(BlogPost.author))
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
        select(BlogPost)
        .options(joinedload(BlogPost.author))
        .where(BlogPost.id == post_id)
    )
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="文章不存在。"
        )

    # Check slug uniqueness if it is changing
    if post_in.slug is not None and post_in.slug != post.slug:
        existing = db.scalar(select(BlogPost).where(BlogPost.slug == post_in.slug, BlogPost.id != post_id))
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
    if post_in.cover_url is not None:
        post.cover_url = post_in.cover_url
    if post_in.excerpt is not None:
        post.excerpt = post_in.excerpt
    if post_in.tags is not None:
        post.tags = post_in.tags
    if post_in.is_public is not None:
        post.is_public = post_in.is_public

    if post_in.is_published is not None:
        # transition from draft to published
        if post_in.is_published and not post.is_published:
            if not post.published_at:
                post.published_at = datetime.now(UTC).replace(tzinfo=None)
        post.is_published = post_in.is_published

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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="文章不存在。"
        )

    db.delete(post)
    db.commit()
    return {"status": "ok", "message": "文章已成功删除。"}


from fastapi import File, UploadFile
import re
import uuid
import os
import shutil
import tempfile
import zipfile
import mimetypes
from app.services.upload import upload_file_to_lsky

@router.post("/api/admin/blog/parse-markdown", dependencies=[Depends(require_root)])
async def parse_markdown_blog(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    filename_lower = file.filename.lower()
    if not filename_lower.endswith(".md") and not filename_lower.endswith(".markdown") and not filename_lower.endswith(".zip"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="只能上传 Markdown (.md) 格式或包含 Markdown 的 .zip 压缩包。"
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
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
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
                    detail="未在 ZIP 压缩包中找到任何 Markdown (.md) 文件。"
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
                        detail="无法解析 Markdown 文件编码，请确保文件保存为 UTF-8 编码。"
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
                if resolved_img_path.startswith(temp_dir) and os.path.exists(resolved_img_path) and os.path.isfile(resolved_img_path):
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
                    detail="无法解析文件编码，请确保文件保存为 UTF-8 编码。"
                )
            
    # 默认值
    meta = {
        "title": "",
        "slug": "",
        "cover_url": None,
        "excerpt": None,
        "tags": None
    }
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
                
                if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
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
            
    return {
        "meta": meta,
        "content": body
    }

