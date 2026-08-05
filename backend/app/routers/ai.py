from io import BytesIO
from pathlib import PurePosixPath
from uuid import uuid4
from xml.etree import ElementTree
from zipfile import BadZipFile, ZipFile

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models.ai_ingest_job import AIIngestJob
from app.models.mcp_blog_token import MCPBlogToken
from app.models.note import Note
from app.models.space import SpaceMember
from app.models.user import User
from app.routers.blog import build_post
from app.schemas.ai import (
    AICapabilitiesResponse,
    AIDraftCreate,
    AIDraftResponse,
    AIIngestResponse,
)
from app.schemas.blog import BlogPostCreate

router = APIRouter(prefix="/api/ai", tags=["ai"])

MAX_INGEST_BYTES = 20 * 1024 * 1024
ALLOWED_INGEST_EXTENSIONS = {".txt", ".md", ".markdown", ".docx", ".pdf"}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


def _extract_docx(data: bytes) -> str:
    try:
        with ZipFile(BytesIO(data)) as archive:
            xml_bytes = archive.read("word/document.xml")
    except (BadZipFile, KeyError) as exc:
        raise ValueError("DOCX 文件结构无效。") from exc
    root = ElementTree.fromstring(xml_bytes)
    paragraphs = []
    for paragraph in root.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p"):
        text = "".join(
            node.text or ""
            for node in paragraph.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t")
        ).strip()
        if text:
            paragraphs.append(text)
    return "\n\n".join(paragraphs)


def _extract_pdf(data: bytes) -> str:
    try:
        from pypdf import PdfReader
    except ImportError as exc:
        raise ValueError("PDF 解析依赖尚未安装，请稍后重试或改用 DOCX。") from exc
    reader = PdfReader(BytesIO(data))
    pages = [(page.extract_text() or "").strip() for page in reader.pages]
    return "\n\n".join(page for page in pages if page)


def _extract_ingest_text(filename: str, media_type: str, data: bytes) -> tuple[str, str]:
    suffix = PurePosixPath(filename).suffix.lower()
    if suffix in IMAGE_EXTENSIONS or media_type.startswith("image/"):
        return "", "ready"
    if suffix in {".txt", ".md", ".markdown"}:
        return data.decode("utf-8-sig"), "completed"
    if suffix == ".docx":
        return _extract_docx(data), "completed"
    if suffix == ".pdf":
        return _extract_pdf(data), "completed"
    raise ValueError("仅支持图片、TXT、Markdown、DOCX 和 PDF 文件。")


def _mcp_flags(db: Session, user: User) -> tuple[bool, bool]:
    if user.is_root:
        return True, True
    token = db.scalar(
        select(MCPBlogToken)
        .where(
            MCPBlogToken.author_id == user.id,
            MCPBlogToken.is_active.is_(True),
        )
        .order_by(MCPBlogToken.id.desc())
    )
    if not user.can_use_mcp or not token:
        return False, False
    return True, bool(token.allow_auto_publish)


@router.get("/capabilities", response_model=AICapabilitiesResponse)
def get_capabilities(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    can_mcp_publish, allow_auto_publish = _mcp_flags(db, current_user)
    return AICapabilitiesResponse(
        can_chat=True,
        can_generate=True,
        can_publish_blog=current_user.is_root or current_user.can_write_blog,
        can_publish_space=True,
        can_mcp_publish=can_mcp_publish,
        allow_auto_publish=allow_auto_publish,
    )


@router.post("/ingest", response_model=AIIngestResponse, status_code=status.HTTP_201_CREATED)
async def ingest_attachment(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    filename = (file.filename or "attachment").strip()[:255]
    suffix = PurePosixPath(filename).suffix.lower()
    if suffix not in ALLOWED_INGEST_EXTENSIONS and suffix not in IMAGE_EXTENSIONS:
        raise HTTPException(status_code=415, detail="仅支持图片、TXT、Markdown、DOCX 和 PDF 文件。")
    data = await file.read()
    if len(data) > MAX_INGEST_BYTES:
        raise HTTPException(status_code=413, detail="文件大小不能超过 20 MB。")

    job = AIIngestJob(
        user_id=current_user.id,
        original_filename=filename,
        media_type=file.content_type or "application/octet-stream",
        size_bytes=len(data),
        status="queued",
    )
    db.add(job)
    db.flush()
    try:
        extracted_text, parsed_status = _extract_ingest_text(filename, job.media_type, data)
        job.extracted_text = extracted_text or None
        job.status = parsed_status
    except ValueError as exc:
        job.status = "failed"
        job.error_message = str(exc)
    db.commit()
    db.refresh(job)
    return AIIngestResponse(
        id=job.id,
        filename=job.original_filename,
        media_type=job.media_type,
        size_bytes=job.size_bytes,
        status=job.status,
        extracted_text=job.extracted_text,
        error_message=job.error_message,
        created_at=job.created_at,
    )


@router.get("/ingest/{job_id}", response_model=AIIngestResponse)
def get_ingest_job(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = db.scalar(
        select(AIIngestJob).where(
            AIIngestJob.id == job_id,
            AIIngestJob.user_id == current_user.id,
        )
    )
    if not job:
        raise HTTPException(status_code=404, detail="解析任务不存在。")
    return AIIngestResponse(
        id=job.id,
        filename=job.original_filename,
        media_type=job.media_type,
        size_bytes=job.size_bytes,
        status=job.status,
        extracted_text=job.extracted_text,
        error_message=job.error_message,
        created_at=job.created_at,
    )


@router.post("/drafts", response_model=AIDraftResponse, status_code=status.HTTP_201_CREATED)
def create_ai_draft(
    draft: AIDraftCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if draft.target == "blog":
        if not current_user.is_root and not current_user.can_write_blog:
            raise HTTPException(status_code=403, detail="需要博客写作权限。")
        post_in = BlogPostCreate(
            title=draft.title,
            slug=f"android-ai-{uuid4().hex[:12]}",
            content=draft.content,
            excerpt=draft.excerpt,
            cover_url=draft.cover_url,
            tags=draft.tags,
            category_id=draft.category_id,
            is_public=bool(draft.publish),
            is_published=bool(draft.publish),
        )
        post = build_post(post_in, current_user, db)
        db.add(post)
        db.commit()
        db.refresh(post)
        public_url = None
        if post.is_public and post.is_published:
            public_url = f"{settings.FRONTEND_BASE_URL.rstrip('/')}/blog/{post.slug}"
        return AIDraftResponse(
            target="blog",
            id=post.id,
            status="published" if post.is_public and post.is_published else "draft",
            url=public_url,
            created_at=post.created_at,
        )

    if draft.space_id is None:
        raise HTTPException(status_code=400, detail="空间文章必须指定 space_id。")
    member = db.scalar(
        select(SpaceMember).where(
            SpaceMember.space_id == draft.space_id,
            SpaceMember.user_id == current_user.id,
        )
    )
    if not member:
        raise HTTPException(status_code=403, detail="您不是该空间的成员。")
    note = Note(
        space_id=draft.space_id,
        title=draft.title,
        content=draft.content,
        cover_url=draft.cover_url,
        author_id=current_user.id,
        is_published=True,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return AIDraftResponse(
        target="space", id=note.id, status="published", created_at=note.created_at
    )
