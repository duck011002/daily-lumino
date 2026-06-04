import httpx
from decimal import Decimal
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.storage_quota import StorageQuota
from app.models.system_config import SystemConfig
from app.models.user import User
from app.utils.crypto import decrypt_value

router = APIRouter(prefix="/api/upload", tags=["upload"])


@router.post("")
async def upload_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 1. Read Lsky Pro configs
    url_config = db.scalar(select(SystemConfig).where(SystemConfig.config_key == "lsky_api_url"))
    token_config = db.scalar(select(SystemConfig).where(SystemConfig.config_key == "lsky_api_token"))
    quota_config = db.scalar(select(SystemConfig).where(SystemConfig.config_key == "storage_quota_mb"))

    lsky_url = url_config.config_val if url_config else None
    lsky_token = decrypt_value(token_config.config_val) if token_config and token_config.config_val else None

    if not lsky_url or not lsky_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="图床尚未配置，无法上传文件。",
        )

    # 2. Check Storage Quota
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

    # Read file content
    content = await file.read()
    file_size_mb = len(content) / (1024 * 1024)

    if float(quota.used_size_mb) + file_size_mb > max_mb:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="空间存储配额不足。",
        )

    # 3. Upload to Lsky Pro (v2 API format usually: /api/v1/upload)
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
            
            # 4. Update quota
            quota.used_size_mb += Decimal(str(file_size_mb))
            db.commit()

            return {
                "status": "ok",
                "message": "上传成功",
                "url": data["data"]["links"]["url"],
                "size_mb": round(file_size_mb, 2)
            }
        except httpx.HTTPError as e:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"请求图床失败: {str(e)}"
            )
