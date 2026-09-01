import json
import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from openai import OpenAI

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_root
from app.models.invite_code import InviteCode
from app.models.mcp_blog_token import MCPBlogToken
from app.models.mcp_library_token import MCPLibraryToken
from app.models.mcp_lumino_token import MCPLuminoToken
from app.models.storage_quota import StorageQuota
from app.models.system_config import SystemConfig
from app.models.user import User
from app.schemas.admin import (
    InviteCodeCreate,
    InviteCodeResponse,
    StorageQuotaResponse,
    StorageQuotaUpdate,
    SystemConfigResponse,
    SystemConfigUpdate,
    UserStatusUpdate,
    AITestConnectionRequest,
    AIGetModelsRequest,
    AIProviderHealthResponse,
    UserAdminResponse,
    MCPBlogTokenCreate,
    MCPBlogTokenCreateResponse,
    MCPBlogTokenResponse,
    MCPBlogTokenUpdate,
    MCPLibraryTokenCreate,
    MCPLibraryTokenCreateResponse,
    MCPLibraryTokenResponse,
    MCPLibraryTokenUpdate,
    MCPLuminoTokenCreate,
    MCPLuminoTokenCreateResponse,
    MCPLuminoTokenResponse,
    MCPLuminoTokenUpdate,
)
from app.schemas.user import UserResponse
from app.utils.crypto import decrypt_value, encrypt_value
from app.services.ai_provider_health import run_provider_health_check

router = APIRouter(
    prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_root)]
)

SENSITIVE_CONFIG_KEYS = {
    "qwen_api_key",
    "deepseek_api_key",
    "lsky_api_token",
}


def mask_secret(value: str) -> str:
    if not value:
        return ""
    if len(value) <= 8:
        return "****"
    return f"{value[:4]}****{value[-4:]}"


def hash_mcp_blog_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def serialize_mcp_library_token(token: MCPLibraryToken) -> dict:
    return {
        "id": token.id,
        "label": token.label,
        "is_active": token.is_active,
        "created_at": token.created_at,
        "last_used_at": token.last_used_at,
    }


def serialize_mcp_blog_token(token: MCPBlogToken) -> dict:
    author_name = token.author.display_name or token.author.username
    return {
        "id": token.id,
        "label": token.label,
        "author_id": token.author_id,
        "author_name": author_name,
        "allow_auto_publish": token.allow_auto_publish,
        "is_active": token.is_active,
        "created_at": token.created_at,
        "last_used_at": token.last_used_at,
    }


def serialize_mcp_lumino_token(token: MCPLuminoToken) -> dict:
    return {
        "id": token.id,
        "label": token.label,
        "user_id": token.user_id,
        "user_name": token.user.display_name or token.user.username,
        "scopes": token.scopes,
        "allow_auto_publish": token.allow_auto_publish,
        "is_active": token.is_active,
        "created_at": token.created_at,
        "last_used_at": token.last_used_at,
    }


def get_mcp_blog_author_or_400(db: Session, author_id: int) -> User:
    author = db.get(User, author_id)
    if not author or not author.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="所选博客作者不可用。"
        )
    if not author.is_root and not author.can_write_blog:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="所选用户没有博客写作权限。",
        )
    return author


def get_mcp_lumino_user_or_400(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="所选 MCP 用户不可用。",
        )
    if not user.is_root and not user.can_use_mcp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="所选用户尚未开通 MCP 使用权限。",
        )
    return user


def validate_mcp_lumino_scopes(
    user: User, scopes: list[str], *, allow_auto_publish: bool = False
) -> None:
    scope_set = set(scopes)
    if any(scope.startswith("blog:") for scope in scope_set):
        if not user.is_root and not user.can_write_blog:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="所选用户没有博客写作权限，不能签发博客作用域。",
            )
    if any(scope.startswith("library:") for scope in scope_set) and not user.is_root:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Library 作用域只能签发给超级管理员。",
        )
    if allow_auto_publish and "blog:publish" not in scope_set:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="允许自动发布时必须同时授予 blog:publish 作用域。",
        )


from app.models.chat import ChatMessage, ChatSession
from app.models.space import SpaceMember
from app.models.blog import BlogPost
from sqlalchemy import func


@router.get("/users", response_model=list[UserAdminResponse])
def list_users(db: Session = Depends(get_db)):
    users = db.scalars(select(User).order_by(User.id.desc())).all()

    # Bulk query token usage
    token_usage_dict = dict(
        db.execute(
            select(ChatSession.user_id, func.sum(ChatMessage.tokens_used))
            .join(ChatMessage)
            .group_by(ChatSession.user_id)
        ).all()
    )
    # Bulk query space count
    space_count_dict = dict(
        db.execute(
            select(SpaceMember.user_id, func.count(SpaceMember.space_id)).group_by(
                SpaceMember.user_id
            )
        ).all()
    )
    # Bulk query blog count
    blog_count_dict = dict(
        db.execute(
            select(BlogPost.author_id, func.count(BlogPost.id))
            .where(BlogPost.deleted_at.is_(None))
            .group_by(BlogPost.author_id)
        ).all()
    )

    for user in users:
        user.token_usage = int(token_usage_dict.get(user.id) or 0)
        user.space_count = int(space_count_dict.get(user.id) or 0)
        user.blog_count = int(blog_count_dict.get(user.id) or 0)

    return users


@router.patch("/users/{user_id}", response_model=UserResponse)
def update_user_status(
    user_id: int, status_in: UserStatusUpdate, db: Session = Depends(get_db)
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在。"
        )
    if status_in.is_active is not None:
        if user.is_root and not status_in.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="不能禁用超级管理员账号。",
            )
        user.is_active = status_in.is_active

    if status_in.can_create_spaces is not None:
        user.can_create_spaces = status_in.can_create_spaces

    if status_in.is_discipline_authorized is not None:
        if user.is_root and not status_in.is_discipline_authorized:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="不能禁用超级管理员的自律记录功能权限。",
            )
        user.is_discipline_authorized = status_in.is_discipline_authorized

    if status_in.can_write_blog is not None:
        user.can_write_blog = status_in.can_write_blog

    if status_in.can_use_mcp is not None:
        user.can_use_mcp = status_in.can_use_mcp

    db.commit()
    db.refresh(user)
    return user


@router.get("/configs", response_model=list[SystemConfigResponse])
def list_configs(db: Session = Depends(get_db)):
    configs = db.scalars(select(SystemConfig).order_by(SystemConfig.id.asc())).all()

    # Mask sensitive credentials
    response_configs = []
    for conf in configs:
        val = conf.config_val
        if conf.config_key in SENSITIVE_CONFIG_KEYS and val:
            decrypted = decrypt_value(val)
            val = mask_secret(decrypted)
        elif conf.config_key == "ai_providers" and val:
            try:
                providers = json.loads(val)
                for p in providers:
                    if "api_key" in p and p["api_key"]:
                        try:
                            decrypted = decrypt_value(p["api_key"])
                            p["api_key"] = mask_secret(decrypted)
                        except Exception:
                            p["api_key"] = mask_secret(p["api_key"])
                val = json.dumps(providers, ensure_ascii=False)
            except Exception:
                pass

        response_configs.append(
            SystemConfigResponse(
                id=conf.id,
                config_key=conf.config_key,
                config_val=val,
                description=conf.description,
                updated_at=conf.updated_at,
            )
        )
    return response_configs


@router.patch("/configs/{key}", response_model=SystemConfigResponse)
def update_config(
    key: str,
    config_in: SystemConfigUpdate,
    current_user: User = Depends(require_root),
    db: Session = Depends(get_db),
):
    config = db.scalar(select(SystemConfig).where(SystemConfig.config_key == key))
    is_new = False
    if not config:
        config = SystemConfig(
            config_key=key, description=f"Dynamic configuration for {key}"
        )
        db.add(config)
        is_new = True

    val_to_save = config_in.config_val
    if key in SENSITIVE_CONFIG_KEYS and val_to_save:
        val_to_save = encrypt_value(val_to_save)
    elif key == "ai_providers" and val_to_save:
        try:
            new_providers = json.loads(val_to_save)
            existing_map = {}
            if not is_new and config.config_val:
                try:
                    old_providers = json.loads(config.config_val)
                    existing_map = {
                        op["id"]: op.get("api_key")
                        for op in old_providers
                        if "id" in op
                    }
                except Exception:
                    pass

            for np in new_providers:
                pid = np.get("id")
                new_key = np.get("api_key")
                if new_key:
                    if "****" in new_key:
                        np["api_key"] = existing_map.get(pid, "")
                    else:
                        np["api_key"] = encrypt_value(new_key)
                        np["is_reachable"] = True
                        np["last_checked"] = datetime.now().isoformat()
                elif "is_reachable" not in np:
                    np["is_reachable"] = True
            val_to_save = json.dumps(new_providers, ensure_ascii=False)
        except Exception as e:
            raise HTTPException(
                status_code=400, detail=f"解析或处理 ai_providers 失败: {str(e)}"
            )

    config.config_val = val_to_save
    config.updated_by = current_user.id
    db.commit()
    db.refresh(config)

    # Return masked value in response
    return_val = config_in.config_val
    if key in SENSITIVE_CONFIG_KEYS and return_val:
        return_val = mask_secret(return_val)
    elif key == "ai_providers" and return_val:
        try:
            saved_providers = json.loads(config.config_val)
            for sp in saved_providers:
                if "api_key" in sp and sp["api_key"]:
                    try:
                        decrypted = decrypt_value(sp["api_key"])
                        sp["api_key"] = mask_secret(decrypted)
                    except Exception:
                        sp["api_key"] = mask_secret(sp["api_key"])
            return_val = json.dumps(saved_providers, ensure_ascii=False)
        except Exception:
            pass

    return SystemConfigResponse(
        id=config.id,
        config_key=config.config_key,
        config_val=return_val,
        description=config.description,
        updated_at=config.updated_at,
    )


@router.post(
    "/invite-codes",
    response_model=InviteCodeResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_invite_code(
    code_in: InviteCodeCreate,
    current_user: User = Depends(require_root),
    db: Session = Depends(get_db),
):
    expires_at = None
    if code_in.expires_in_hours:
        expires_at = datetime.now(UTC).replace(tzinfo=None) + timedelta(
            hours=code_in.expires_in_hours
        )

    db_code = InviteCode(
        code=secrets.token_hex(16),  # 32 characters hex string
        created_by=current_user.id,
        expires_at=expires_at,
    )
    db.add(db_code)
    db.commit()
    db.refresh(db_code)
    return db_code


@router.get("/invite-codes", response_model=list[InviteCodeResponse])
def list_invite_codes(db: Session = Depends(get_db)):
    codes = db.scalars(select(InviteCode).order_by(InviteCode.id.desc())).all()
    return codes


@router.get("/mcp-blog/tokens", response_model=list[MCPBlogTokenResponse])
def list_mcp_blog_tokens(db: Session = Depends(get_db)):
    tokens = db.scalars(select(MCPBlogToken).order_by(MCPBlogToken.id.desc())).all()
    return [serialize_mcp_blog_token(token) for token in tokens]


@router.post(
    "/mcp-blog/tokens",
    response_model=MCPBlogTokenCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_mcp_blog_token(
    token_in: MCPBlogTokenCreate,
    current_user: User = Depends(require_root),
    db: Session = Depends(get_db),
):
    get_mcp_blog_author_or_400(db, token_in.author_id)
    raw_token = f"lmb_mcp_{secrets.token_urlsafe(32)}"
    token = MCPBlogToken(
        label=token_in.label.strip(),
        token_hash=hash_mcp_blog_token(raw_token),
        author_id=token_in.author_id,
        created_by=current_user.id,
        allow_auto_publish=token_in.allow_auto_publish,
    )
    db.add(token)
    db.commit()
    db.refresh(token)
    return {**serialize_mcp_blog_token(token), "token": raw_token}


@router.patch("/mcp-blog/tokens/{token_id}", response_model=MCPBlogTokenResponse)
def update_mcp_blog_token(
    token_id: int,
    token_in: MCPBlogTokenUpdate,
    db: Session = Depends(get_db),
):
    token = db.get(MCPBlogToken, token_id)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="MCP 凭据不存在。"
        )
    if token_in.author_id is not None:
        get_mcp_blog_author_or_400(db, token_in.author_id)
        token.author_id = token_in.author_id
    if token_in.allow_auto_publish is not None:
        token.allow_auto_publish = token_in.allow_auto_publish
    if token_in.is_active is not None:
        token.is_active = token_in.is_active
    db.commit()
    db.refresh(token)
    return serialize_mcp_blog_token(token)


@router.get("/mcp-library/tokens", response_model=list[MCPLibraryTokenResponse])
def list_mcp_library_tokens(db: Session = Depends(get_db)):
    tokens = db.scalars(
        select(MCPLibraryToken).order_by(MCPLibraryToken.id.desc())
    ).all()
    return [serialize_mcp_library_token(token) for token in tokens]


@router.post(
    "/mcp-library/tokens",
    response_model=MCPLibraryTokenCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_mcp_library_token(
    token_in: MCPLibraryTokenCreate,
    current_user: User = Depends(require_root),
    db: Session = Depends(get_db),
):
    raw_token = f"lml_mcp_{secrets.token_urlsafe(32)}"
    token = MCPLibraryToken(
        label=token_in.label.strip(),
        token_hash=hash_mcp_blog_token(raw_token),
        created_by=current_user.id,
    )
    db.add(token)
    db.commit()
    db.refresh(token)
    return {**serialize_mcp_library_token(token), "token": raw_token}


@router.patch("/mcp-library/tokens/{token_id}", response_model=MCPLibraryTokenResponse)
def update_mcp_library_token(
    token_id: int,
    token_in: MCPLibraryTokenUpdate,
    db: Session = Depends(get_db),
):
    token = db.get(MCPLibraryToken, token_id)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="书房 MCP 凭据不存在。"
        )
    token.is_active = token_in.is_active
    db.commit()
    db.refresh(token)
    return serialize_mcp_library_token(token)


@router.get("/mcp-lumino/tokens", response_model=list[MCPLuminoTokenResponse])
def list_mcp_lumino_tokens(db: Session = Depends(get_db)):
    tokens = db.scalars(select(MCPLuminoToken).order_by(MCPLuminoToken.id.desc())).all()
    return [serialize_mcp_lumino_token(token) for token in tokens]


@router.post(
    "/mcp-lumino/tokens",
    response_model=MCPLuminoTokenCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_mcp_lumino_token(
    token_in: MCPLuminoTokenCreate,
    current_user: User = Depends(require_root),
    db: Session = Depends(get_db),
):
    target_user = get_mcp_lumino_user_or_400(db, token_in.user_id)
    validate_mcp_lumino_scopes(
        target_user,
        token_in.scopes,
        allow_auto_publish=token_in.allow_auto_publish,
    )
    raw_token = f"lmu_mcp_{secrets.token_urlsafe(32)}"
    token = MCPLuminoToken(
        label=token_in.label.strip(),
        token_hash=hash_mcp_blog_token(raw_token),
        user_id=token_in.user_id,
        created_by=current_user.id,
        scopes=list(dict.fromkeys(token_in.scopes)),
        allow_auto_publish=token_in.allow_auto_publish,
    )
    db.add(token)
    db.commit()
    db.refresh(token)
    return {**serialize_mcp_lumino_token(token), "token": raw_token}


@router.patch("/mcp-lumino/tokens/{token_id}", response_model=MCPLuminoTokenResponse)
def update_mcp_lumino_token(
    token_id: int,
    token_in: MCPLuminoTokenUpdate,
    db: Session = Depends(get_db),
):
    token = db.get(MCPLuminoToken, token_id)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lumino MCP 凭据不存在。",
        )
    target_user = get_mcp_lumino_user_or_400(db, token.user_id)
    next_scopes = token_in.scopes if token_in.scopes is not None else token.scopes
    next_auto_publish = (
        token_in.allow_auto_publish
        if token_in.allow_auto_publish is not None
        else token.allow_auto_publish
    )
    validate_mcp_lumino_scopes(
        target_user,
        next_scopes,
        allow_auto_publish=next_auto_publish,
    )
    if token_in.scopes is not None:
        token.scopes = list(dict.fromkeys(token_in.scopes))
    if token_in.allow_auto_publish is not None:
        token.allow_auto_publish = token_in.allow_auto_publish
    if token_in.is_active is not None:
        token.is_active = token_in.is_active
    db.commit()
    db.refresh(token)
    return serialize_mcp_lumino_token(token)


@router.get("/storage-quota", response_model=StorageQuotaResponse)
def get_storage_quota(db: Session = Depends(get_db)):
    quota = db.scalar(select(StorageQuota))
    if not quota:
        # Auto initialize if empty
        quota = StorageQuota(max_size_mb=1024.0, used_size_mb=0.0)
        db.add(quota)
        db.commit()
        db.refresh(quota)
    return quota


@router.patch("/storage-quota", response_model=StorageQuotaResponse)
def update_storage_quota(quota_in: StorageQuotaUpdate, db: Session = Depends(get_db)):
    quota = db.scalar(select(StorageQuota))
    if not quota:
        quota = StorageQuota(max_size_mb=quota_in.max_size_mb, used_size_mb=0.0)
        db.add(quota)
    else:
        quota.max_size_mb = quota_in.max_size_mb

    db.commit()
    db.refresh(quota)
    return quota


def resolve_api_key(db: Session, provider_id: str | None, api_key: str) -> str:
    if not api_key:
        return ""
    if "****" in api_key:
        if not provider_id:
            raise HTTPException(
                status_code=400,
                detail="检测到 API Key 已脱敏，但未提供服务商 ID 无法恢复。",
            )
        cfg = db.scalar(
            select(SystemConfig).where(SystemConfig.config_key == "ai_providers")
        )
        if not cfg or not cfg.config_val:
            raise HTTPException(status_code=400, detail="未配置任何 AI 服务商。")
        try:
            providers = json.loads(cfg.config_val)
            for p in providers:
                if p.get("id") == provider_id:
                    enc_key = p.get("api_key")
                    if enc_key:
                        return decrypt_value(enc_key)
            raise HTTPException(
                status_code=400, detail=f"未找到 ID 为 {provider_id} 的服务商。"
            )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"解密 API Key 失败: {str(e)}")
    return api_key


@router.post("/ai/test-connection", response_model=AIProviderHealthResponse)
def test_connection(req: AITestConnectionRequest, db: Session = Depends(get_db)):
    api_key = resolve_api_key(db, req.id, req.api_key)
    result = run_provider_health_check(
        client_factory=OpenAI,
        api_key=api_key,
        base_url=req.base_url,
        model=req.model,
    )

    if req.id:
        cfg = db.scalar(
            select(SystemConfig).where(SystemConfig.config_key == "ai_providers")
        )
        if cfg and cfg.config_val:
            try:
                providers = json.loads(cfg.config_val)
                for provider in providers:
                    if provider.get("id") != req.id:
                        continue
                    provider["is_reachable"] = result.status == "success"
                    provider["last_checked"] = result.checked_at.isoformat()
                    provider["last_check_model"] = result.model
                    provider["last_error_category"] = result.error_category
                    provider["last_error_message"] = (
                        result.message[:800] if result.status == "error" else None
                    )
                    cfg.config_val = json.dumps(providers, ensure_ascii=False)
                    db.commit()
                    break
            except (TypeError, ValueError, json.JSONDecodeError):
                db.rollback()

    return result


@router.post("/ai/models")
def get_models(req: AIGetModelsRequest, db: Session = Depends(get_db)):
    try:
        api_key = resolve_api_key(db, req.id, req.api_key)
        client = OpenAI(api_key=api_key, base_url=req.base_url or None)
        models_data = client.models.list()
        model_ids = [m.id for m in models_data.data]
        return {"status": "success", "models": model_ids}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"获取模型列表失败: {str(e)}")


@router.post("/ai/check-all")
def check_all_providers(db: Session = Depends(get_db)):
    import concurrent.futures

    cfg = db.scalar(
        select(SystemConfig).where(SystemConfig.config_key == "ai_providers")
    )
    if not cfg or not cfg.config_val:
        return {"status": "success", "providers": []}

    try:
        providers = json.loads(cfg.config_val)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"解析 ai_providers 失败: {str(e)}")

    def test_single_provider(p):
        pid = p.get("id")
        pname = p.get("name", pid)
        api_key_raw = p.get("api_key")
        base_url = p.get("base_url")

        # Determine model to test
        models_list = p.get("models")
        test_model = "gpt-3.5-turbo"
        if models_list and isinstance(models_list, list) and len(models_list) > 0:
            test_model = models_list[0]
        elif p.get("model"):
            test_model = p.get("model")

        try:
            api_key = resolve_api_key(db, pid, api_key_raw)
            if not api_key:
                return False
            client = OpenAI(api_key=api_key, base_url=base_url or None)
            client.chat.completions.create(
                model=test_model,
                messages=[{"role": "user", "content": "ping"}],
                max_tokens=1,
                timeout=10.0,
            )
            return True
        except Exception as e:
            print(f"测试服务商 {pname} 失败: {e}")
            return False

    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(test_single_provider, p): p for p in providers}
        for future in concurrent.futures.as_completed(futures):
            p = futures[future]
            try:
                success = future.result()
                p["is_reachable"] = success
                p["last_checked"] = datetime.now().isoformat()
            except Exception:
                p["is_reachable"] = False
                p["last_checked"] = datetime.now().isoformat()

    # Save back to database
    cfg.config_val = json.dumps(providers, ensure_ascii=False)
    db.commit()

    # Return providers with masked API keys
    masked_providers = json.loads(cfg.config_val)
    for p in masked_providers:
        if "api_key" in p and p["api_key"]:
            try:
                decrypted = decrypt_value(p["api_key"])
                p["api_key"] = mask_secret(decrypted)
            except Exception:
                p["api_key"] = mask_secret(p["api_key"])

    return {"status": "success", "providers": masked_providers}
