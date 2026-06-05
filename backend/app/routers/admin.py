import secrets
import json
from datetime import UTC, datetime, timedelta
from openai import OpenAI

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_root
from app.models.invite_code import InviteCode
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
)
from app.schemas.user import UserResponse
from app.utils.crypto import decrypt_value, encrypt_value

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_root)])

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


@router.get("/users", response_model=list[UserResponse])
def list_users(db: Session = Depends(get_db)):
    users = db.scalars(select(User).order_by(User.id.desc())).all()
    return users


@router.patch("/users/{user_id}", response_model=UserResponse)
def update_user_status(user_id: int, status_in: UserStatusUpdate, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在。")
    if status_in.is_active is not None:
        if user.is_root and not status_in.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="不能禁用超级管理员账号。"
            )
        user.is_active = status_in.is_active

    if status_in.can_create_spaces is not None:
        user.can_create_spaces = status_in.can_create_spaces

    if status_in.is_discipline_authorized is not None:
        if user.is_root and not status_in.is_discipline_authorized:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="不能禁用超级管理员的自律记录功能权限。"
            )
        user.is_discipline_authorized = status_in.is_discipline_authorized

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
        config = SystemConfig(config_key=key, description=f"Dynamic configuration for {key}")
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
                    existing_map = {op["id"]: op.get("api_key") for op in old_providers if "id" in op}
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
            raise HTTPException(status_code=400, detail=f"解析或处理 ai_providers 失败: {str(e)}")

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
    "/invite-codes", response_model=InviteCodeResponse, status_code=status.HTTP_201_CREATED
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
            raise HTTPException(status_code=400, detail="检测到 API Key 已脱敏，但未提供服务商 ID 无法恢复。")
        cfg = db.scalar(select(SystemConfig).where(SystemConfig.config_key == "ai_providers"))
        if not cfg or not cfg.config_val:
            raise HTTPException(status_code=400, detail="未配置任何 AI 服务商。")
        try:
            providers = json.loads(cfg.config_val)
            for p in providers:
                if p.get("id") == provider_id:
                    enc_key = p.get("api_key")
                    if enc_key:
                        return decrypt_value(enc_key)
            raise HTTPException(status_code=400, detail=f"未找到 ID 为 {provider_id} 的服务商。")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"解密 API Key 失败: {str(e)}")
    return api_key


@router.post("/ai/test-connection")
def test_connection(req: AITestConnectionRequest, db: Session = Depends(get_db)):
    try:
        api_key = resolve_api_key(db, req.id, req.api_key)
        client = OpenAI(api_key=api_key, base_url=req.base_url or None)
        # Test connection with a very simple completion request
        client.chat.completions.create(
            model=req.model,
            messages=[{"role": "user", "content": "ping"}],
            max_tokens=1,
            timeout=10.0,
        )
        # Automatically mark as reachable in the database if it was saved
        if req.id:
            cfg = db.scalar(select(SystemConfig).where(SystemConfig.config_key == "ai_providers"))
            if cfg and cfg.config_val:
                try:
                    providers = json.loads(cfg.config_val)
                    updated = False
                    for p in providers:
                        if p.get("id") == req.id:
                            p["is_reachable"] = True
                            p["last_checked"] = datetime.now().isoformat()
                            updated = True
                            break
                    if updated:
                        cfg.config_val = json.dumps(providers, ensure_ascii=False)
                        db.commit()
                except Exception as e:
                    print(f"Failed to auto-update is_reachable on test success: {e}")
                    
        return {"status": "success", "message": "连接测试成功！"}
    except Exception as e:
        return {"status": "error", "message": f"连接测试失败: {str(e)}"}


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
    cfg = db.scalar(select(SystemConfig).where(SystemConfig.config_key == "ai_providers"))
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

