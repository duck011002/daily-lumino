import httpx
from decimal import Decimal
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.album import Album, Photo
from app.models.space import SpaceMember
from app.models.storage_quota import StorageQuota
from app.models.system_config import SystemConfig
from app.models.user import User
from app.schemas.album import AlbumCreate, AlbumResponse, AlbumUpdate, PhotoResponse
from app.utils.crypto import decrypt_value

router = APIRouter(prefix="/api/spaces/{space_id}/albums", tags=["albums"])


def require_membership(db: Session, space_id: int, user_id: int) -> SpaceMember:
    member = db.scalar(
        select(SpaceMember).where(
            SpaceMember.space_id == space_id, SpaceMember.user_id == user_id
        )
    )
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="您不是该空间的成员，无权访问。")
    return member


def get_album_or_404(db: Session, album_id: int, space_id: int) -> Album:
    album = db.scalar(select(Album).where(Album.id == album_id, Album.space_id == space_id))
    if not album:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="相册不存在。")
    return album


def build_album_response(album: Album) -> AlbumResponse:
    return AlbumResponse(
        id=album.id,
        space_id=album.space_id,
        name=album.name,
        cover_url=album.cover_url,
        created_by=album.created_by,
        created_at=album.created_at,
        photo_count=len(album.photos),
    )


# ========== Album CRUD ==========

@router.post("", response_model=AlbumResponse, status_code=status.HTTP_201_CREATED)
def create_album(
    space_id: int,
    album_in: AlbumCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_membership(db, space_id, current_user.id)

    album = Album(
        space_id=space_id,
        name=album_in.name,
        cover_url=album_in.cover_url,
        created_by=current_user.id,
    )
    db.add(album)
    db.commit()
    db.refresh(album)
    return build_album_response(album)


@router.get("", response_model=List[AlbumResponse])
def list_albums(
    space_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_membership(db, space_id, current_user.id)

    albums = db.scalars(
        select(Album).where(Album.space_id == space_id).order_by(Album.created_at.desc())
    ).all()
    return [build_album_response(a) for a in albums]


@router.get("/{album_id}", response_model=AlbumResponse)
def get_album(
    space_id: int,
    album_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_membership(db, space_id, current_user.id)
    album = get_album_or_404(db, album_id, space_id)
    return build_album_response(album)


@router.patch("/{album_id}", response_model=AlbumResponse)
def update_album(
    space_id: int,
    album_id: int,
    album_in: AlbumUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_membership(db, space_id, current_user.id)
    album = get_album_or_404(db, album_id, space_id)

    if album_in.name is not None:
        album.name = album_in.name
    if album_in.cover_url is not None:
        album.cover_url = album_in.cover_url

    db.commit()
    db.refresh(album)
    return build_album_response(album)


@router.delete("/{album_id}")
def delete_album(
    space_id: int,
    album_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_membership(db, space_id, current_user.id)
    album = get_album_or_404(db, album_id, space_id)
    
    # Calculate total size of photos in this album to subtract from quota
    total_kb = sum(photo.file_size_kb for photo in album.photos)
    total_mb = total_kb / 1024

    db.delete(album)
    
    # Update quota
    quota = db.scalar(select(StorageQuota))
    if quota and quota.used_size_mb >= Decimal(str(total_mb)):
        quota.used_size_mb -= Decimal(str(total_mb))

    db.commit()
    return {"status": "ok", "message": "相册已删除。"}


# ========== Photo CRUD ==========

@router.post("/{album_id}/photos", response_model=PhotoResponse, status_code=status.HTTP_201_CREATED)
async def upload_photo(
    space_id: int,
    album_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_membership(db, space_id, current_user.id)
    album = get_album_or_404(db, album_id, space_id)

    if file.content_type not in ["image/jpeg", "image/png", "image/webp", "image/gif", "image/jpg"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="仅支持 JPG, PNG, WEBP, GIF 格式的图片。",
        )

    # Read config
    url_config = db.scalar(select(SystemConfig).where(SystemConfig.config_key == "lsky_api_url"))
    token_config = db.scalar(select(SystemConfig).where(SystemConfig.config_key == "lsky_api_token"))
    quota_config = db.scalar(select(SystemConfig).where(SystemConfig.config_key == "storage_quota_mb"))

    lsky_url = url_config.config_val if url_config else None
    lsky_token = decrypt_value(token_config.config_val) if token_config and token_config.config_val else None

    if not lsky_url or not lsky_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="系统尚未配置图床，无法上传照片。",
        )

    # Check Storage Quota
    quota = db.scalar(select(StorageQuota))
    if not quota:
        quota = StorageQuota(max_size_mb=Decimal("1024.00"), used_size_mb=Decimal("0.00"))
        db.add(quota)
        db.commit()
        db.refresh(quota)

    max_mb = float(quota.max_size_mb)
    if quota_config and quota_config.config_val:
        try:
            max_mb = float(quota_config.config_val)
        except ValueError:
            pass

    content = await file.read()
    file_size_kb = len(content) / 1024
    file_size_mb = file_size_kb / 1024

    if float(quota.used_size_mb) + file_size_mb > max_mb:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="空间存储配额不足。",
        )

    # Upload to Lsky Pro
    upload_url = lsky_url.rstrip("/") + "/api/v1/upload"
    headers = {
        "Authorization": f"Bearer {lsky_token}",
        "Accept": "application/json",
    }
    files = {"file": (file.filename, content, file.content_type)}

    async with httpx.AsyncClient() as client:
        try:
            res = await client.post(upload_url, headers=headers, files=files, timeout=30.0)
            res.raise_for_status()
            data = res.json()
            if not data.get("status"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=data.get("message", "上传失败"),
                )
            
            # Save photo to DB
            photo = Photo(
                album_id=album_id,
                space_id=space_id,
                uploader_id=current_user.id,
                url=data["data"]["links"]["url"],
                thumb_url=data["data"]["links"].get("thumbnail_url"),
                file_size_kb=int(file_size_kb),
            )
            db.add(photo)

            # Update album cover if it's the first photo
            if not album.cover_url:
                album.cover_url = photo.url
            
            # Update quota
            quota.used_size_mb += Decimal(str(file_size_mb))
            db.commit()
            db.refresh(photo)

            return photo
        except httpx.HTTPError as e:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"请求图床失败: {str(e)}"
            )


@router.get("/{album_id}/photos", response_model=List[PhotoResponse])
def list_photos(
    space_id: int,
    album_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_membership(db, space_id, current_user.id)
    get_album_or_404(db, album_id, space_id)

    photos = db.scalars(
        select(Photo)
        .where(Photo.album_id == album_id)
        .order_by(Photo.created_at.desc())
    ).all()
    return photos


@router.delete("/{album_id}/photos/{photo_id}")
def delete_photo(
    space_id: int,
    album_id: int,
    photo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_membership(db, space_id, current_user.id)
    album = get_album_or_404(db, album_id, space_id)

    photo = db.scalar(select(Photo).where(Photo.id == photo_id, Photo.album_id == album_id))
    if not photo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="照片不存在。")

    # Subtract quota
    file_size_mb = photo.file_size_kb / 1024
    quota = db.scalar(select(StorageQuota))
    if quota and quota.used_size_mb >= Decimal(str(file_size_mb)):
        quota.used_size_mb -= Decimal(str(file_size_mb))

    db.delete(photo)

    # Update album cover if we deleted the current cover
    if album.cover_url == photo.url:
        remaining_photo = db.scalar(select(Photo).where(Photo.album_id == album_id).order_by(Photo.created_at.desc()))
        if remaining_photo:
            album.cover_url = remaining_photo.url
        else:
            album.cover_url = None

    db.commit()
    return {"status": "ok", "message": "照片已删除。"}
