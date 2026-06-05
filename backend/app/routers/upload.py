from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.services.upload import upload_file_to_lsky

router = APIRouter(prefix="/api/upload", tags=["upload"])


@router.post("")
async def upload_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    content = await file.read()
    file_size_mb = len(content) / (1024 * 1024)
    url = await upload_file_to_lsky(file.filename, content, file.content_type, db)
    return {
        "status": "ok",
        "message": "上传成功",
        "url": url,
        "size_mb": round(file_size_mb, 2)
    }
