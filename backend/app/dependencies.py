from fastapi import Cookie, Depends, HTTPException, Path, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.space import SpaceMember, SpaceMemberRole
from app.models.user import User
from app.services.auth import decode_token


def get_current_user(
    access_token: str | None = Cookie(None), db: Session = Depends(get_db)
) -> User:
    if not access_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未登录，请先登录。")
    payload = decode_token(access_token)
    user_id_str = payload.get("sub")
    token_type = payload.get("type")

    if not user_id_str or token_type != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="登录凭证已失效，请重新登录。"
        )

    try:
        user_id = int(user_id_str)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="无效的登录凭证。")

    user = db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户不存在。")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="该账号已被禁用。")
    return user


def require_root(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_root:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="权限不足，需要管理员权限。"
        )
    return current_user


def require_space_member(
    space_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SpaceMember:
    member = db.scalar(
        select(SpaceMember).where(
            SpaceMember.space_id == space_id, SpaceMember.user_id == current_user.id
        )
    )
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="您不是该空间的成员，无权访问。"
        )
    return member


def require_space_owner(
    space_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SpaceMember:
    member = db.scalar(
        select(SpaceMember).where(
            SpaceMember.space_id == space_id,
            SpaceMember.user_id == current_user.id,
            SpaceMember.role == SpaceMemberRole.OWNER,
        )
    )
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="您不是该空间的所有者，无权执行此操作。"
        )
    return member
