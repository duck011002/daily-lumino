from decimal import Decimal
import ipaddress
from urllib.parse import urlsplit, urlunsplit

import httpx
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.storage_quota import StorageQuota
from app.models.system_config import SystemConfig
from app.utils.crypto import decrypt_value


def _is_private_host(host: str) -> bool:
    if host.lower() == "localhost":
        return True
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        return False
    return address.is_loopback or address.is_private


def lsky_public_base_url(db: Session) -> str:
    public_url_config = db.scalar(
        select(SystemConfig).where(SystemConfig.config_key == "lsky_public_url")
    )
    if public_url_config and public_url_config.config_val:
        return public_url_config.config_val
    return settings.LSKY_PUBLIC_URL or settings.FRONTEND_BASE_URL


def public_image_url(raw_url: str, public_base_url: str | None = None) -> str:
    """Return an HTTPS URL that browsers and remote clients can fetch.

    Lsky may run on a private HTTP address such as ``http://10.0.0.5:40027``.
    In that case ``lsky_public_url`` replaces only the origin while retaining the
    returned path and query string. An already absolute HTTPS URL is returned
    unchanged: it must never be concatenated with the configured public base.
    """
    source = urlsplit(raw_url.strip())
    is_relative_path = not source.scheme and not source.netloc and source.path.startswith("/")
    if (not source.scheme or not source.netloc) and not is_relative_path:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="图床返回了无效的图片地址。",
        )

    source_is_private = bool(source.hostname and _is_private_host(source.hostname))
    if source.scheme == "https" and not source_is_private:
        return raw_url

    if source.scheme not in {"", "http", "https"}:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="图床返回了不受支持的图片地址协议。",
        )

    if public_base_url:
        public_base = urlsplit(public_base_url.rstrip("/"))
        if (
            public_base.scheme != "https"
            or not public_base.netloc
            or not public_base.hostname
            or _is_private_host(public_base.hostname)
        ):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="图床公网地址必须是完整的 HTTPS 域名地址。",
            )
        base_path = public_base.path.rstrip("/")
        source_path = source.path if source.path.startswith("/") else f"/{source.path}"
        return urlunsplit(
            (
                "https",
                public_base.netloc,
                f"{base_path}{source_path}",
                source.query,
                "",
            )
        )

    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=(
            "图床返回了非 HTTPS 图片地址。请配置 lsky_public_url 为图床的公网 HTTPS 域名。"
        ),
    )


def lsky_upload_url(api_base_url: str) -> str:
    """Build Lsky's v1 upload endpoint from either supported base URL form."""
    base = api_base_url.rstrip("/")
    if base.endswith("/api/v1/upload"):
        return base
    if base.endswith("/api/v1"):
        return f"{base}/upload"
    if base.endswith("/api"):
        return f"{base}/v1/upload"
    return f"{base}/api/v1/upload"


async def upload_file_to_lsky(
    filename: str, content: bytes, content_type: str, db: Session
) -> str:
    # 1. Read Lsky Pro configs
    url_config = db.scalar(select(SystemConfig).where(SystemConfig.config_key == "lsky_api_url"))
    token_config = db.scalar(
        select(SystemConfig).where(SystemConfig.config_key == "lsky_api_token")
    )
    quota_config = db.scalar(
        select(SystemConfig).where(SystemConfig.config_key == "storage_quota_mb")
    )
    lsky_url = url_config.config_val if url_config else None
    lsky_token = (
        decrypt_value(token_config.config_val)
        if token_config and token_config.config_val
        else None
    )

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

    file_size_mb = len(content) / (1024 * 1024)

    if float(quota.used_size_mb) + file_size_mb > max_mb:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="空间存储配额不足。",
        )

    # 3. Upload to Lsky Pro (v2 API format usually: /api/v1/upload)
    upload_url = lsky_upload_url(lsky_url)
    headers = {
        "Authorization": f"Bearer {lsky_token}",
        "Accept": "application/json",
    }
    files = {"file": (filename, content, content_type)}

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

            return public_image_url(
                data["data"]["links"]["url"],
                lsky_public_base_url(db),
            )
        except httpx.HTTPError as e:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"请求图床失败: {str(e)}"
            ) from e
