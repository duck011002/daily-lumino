from datetime import UTC, datetime

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from fastapi.responses import HTMLResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models.invite_code import InviteCode
from app.models.user import User
from app.schemas.auth import InviteRequestCreate, InviteRequestCreateResponse, LoginRequest, TokenResponse
from app.schemas.user import UserCreate, UserResponse
from app.services.auth import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.services.invite_requests import (
    handle_admin_action,
    submit_invite_request,
    verify_invite_request,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    )


def clear_auth_cookies(response: Response):
    response.delete_cookie(
        key="access_token", httponly=True, samesite="lax", secure=settings.cookie_secure
    )
    response.delete_cookie(
        key="refresh_token", httponly=True, samesite="lax", secure=settings.cookie_secure
    )


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    existing_user = db.scalar(
        select(User).where((User.username == user_in.username) | (User.email == user_in.email))
    )
    if existing_user:
        if existing_user.username == user_in.username:
            raise HTTPException(status_code=400, detail="用户名已存在。")
        raise HTTPException(status_code=400, detail="邮箱已被注册。")

    invite_code_obj = db.scalar(
        select(InviteCode).where(InviteCode.code == user_in.invite_code, InviteCode.used_by.is_(None))
    )
    if not invite_code_obj:
        raise HTTPException(status_code=400, detail="邀请码无效或已使用。")

    if invite_code_obj.expires_at and invite_code_obj.expires_at < datetime.now(UTC).replace(
        tzinfo=None
    ):
        raise HTTPException(status_code=400, detail="邀请码已过期。")

    if invite_code_obj.target_email and invite_code_obj.target_email != user_in.email:
        raise HTTPException(status_code=400, detail="该邀请码仅可用于申请时填写的邮箱。")

    db_user = User(
        username=user_in.username,
        email=user_in.email,
        password=hash_password(user_in.password),
        display_name=user_in.display_name or user_in.username,
        avatar_url=user_in.avatar_url,
        is_root=False,
        is_active=True,
    )
    db.add(db_user)
    db.flush()

    invite_code_obj.used_by = db_user.id
    invite_code_obj.used_at = func.now()

    from app.models.space import Space, SpaceMember, SpaceMemberRole, SpaceType

    personal_space = Space(
        name="个人空间",
        type=SpaceType.PERSONAL,
        description="您的专属个人空间，用于记录打卡、日记等私密内容。",
        created_by=db_user.id,
    )
    db.add(personal_space)
    db.flush()

    owner_member = SpaceMember(
        space_id=personal_space.id,
        user_id=db_user.id,
        role=SpaceMemberRole.OWNER,
    )
    db.add(owner_member)

    db.commit()
    db.refresh(db_user)
    return db_user


def render_status_page(message: str, status_code: int) -> HTMLResponse:
    content = f"""
    <html>
      <head><meta charset="utf-8"><title>Lumino</title></head>
      <body style="font-family: sans-serif; padding: 32px; line-height: 1.6;">
        <h1>{message}</h1>
      </body>
    </html>
    """
    return HTMLResponse(content=content, status_code=status_code)


@router.post("/invite-requests", response_model=InviteRequestCreateResponse, status_code=status.HTTP_202_ACCEPTED)
def create_invite_request(
    invite_request_in: InviteRequestCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    invite_request = submit_invite_request(
        db=db,
        email=invite_request_in.email,
        display_name=invite_request_in.display_name,
        message=invite_request_in.message,
        request_ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return {
        "message": "如果该邮箱可以接收申请邮件，请查收并完成邮箱验证",
        "request_id": invite_request.id,
    }


@router.get("/invite-requests/verify", response_class=HTMLResponse)
def verify_invite_request_route(token: str, db: Session = Depends(get_db)):
    status_code, message = verify_invite_request(db, token)
    return render_status_page(message, status_code)


@router.get("/invite-requests/admin-action", response_class=HTMLResponse)
def invite_request_admin_action(action: str, token: str, db: Session = Depends(get_db)):
    status_code, message = handle_admin_action(db, token, action)
    return render_status_page(message, status_code)


@router.post("/login", response_model=TokenResponse)
def login(login_in: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(
        select(User).where(
            (User.username == login_in.username_or_email)
            | (User.email == login_in.username_or_email)
        )
    )

    if not user or not verify_password(login_in.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名、邮箱或密码错误。",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="该账号已被禁用，请联系管理员。",
        )

    access_token = create_access_token(user.id, user.is_root)
    refresh_token = create_refresh_token(user.id)

    set_auth_cookies(response, access_token, refresh_token)
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    response: Response, refresh_token: str | None = Cookie(None), db: Session = Depends(get_db)
):
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="没有找到刷新凭证，请重新登录。",
        )

    payload = decode_token(refresh_token)
    user_id_str = payload.get("sub")
    token_type = payload.get("type")

    if not user_id_str or token_type != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的刷新凭证，请重新登录。",
        )

    try:
        user_id = int(user_id_str)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的刷新凭证。",
        ) from exc

    user = db.scalar(select(User).where(User.id == user_id))
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在或已被禁用。",
        )

    new_access_token = create_access_token(user.id, user.is_root)
    new_refresh_token = create_refresh_token(user.id)

    set_auth_cookies(response, new_access_token, new_refresh_token)
    return {"access_token": new_access_token, "token_type": "bearer"}


@router.post("/logout")
def logout(response: Response):
    clear_auth_cookies(response)
    return {"status": "ok", "message": "已成功退出登录。"}


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user
