import os
import sys

# Ensure backend directory is in python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select

from app.config import settings
from app.database import SessionLocal
from app.models.storage_quota import StorageQuota
from app.models.system_config import SystemConfig
from app.models.user import User
from app.services.auth import hash_password
from app.utils.crypto import encrypt_value


def init_db():
    db = SessionLocal()
    try:
        # 0. Automatically create tables for new models if they don't exist
        from app.database import Base, engine
        from app.models.discipline import UserHealthProfile, DailyDisciplineLog
        from sqlalchemy import text
        
        Base.metadata.create_all(bind=engine)
        
        with engine.connect() as conn:
            try:
                check_col = conn.execute(text("SHOW COLUMNS FROM users LIKE 'is_discipline_authorized'")).fetchone()
                if not check_col:
                    conn.execute(text("ALTER TABLE users ADD COLUMN is_discipline_authorized BOOLEAN NOT NULL DEFAULT FALSE"))
                    conn.commit()
                    print("Successfully added is_discipline_authorized column to users table.")
            except Exception as e:
                print(f"Skipping MySQL-specific alter column check: {e}")

            # Ensure spaces.type ENUM includes 'personal' and all values are lowercase
            try:
                # Check current enum definition
                col_info = conn.execute(text("SHOW COLUMNS FROM spaces LIKE 'type'")).fetchone()
                if col_info:
                    col_type_str = str(col_info[1]).lower()  # e.g. "enum('couple','family','friends')"
                    needs_personal = "'personal'" not in col_type_str
                    has_uppercase = any(v in col_type_str for v in ["'couple","'family","'friends","'personal"] if v[1].isupper())
                    if needs_personal or "'COUPLE'" in str(col_info[1]) or "'FAMILY'" in str(col_info[1]):
                        # Normalize all values to lowercase first
                        conn.execute(text("UPDATE spaces SET type = LOWER(type) WHERE type != LOWER(type)"))
                        # Alter column to lowercase enum including personal
                        conn.execute(text("ALTER TABLE spaces MODIFY COLUMN type ENUM('couple', 'family', 'friends', 'personal') NOT NULL"))
                        conn.commit()
                        print("Migrated spaces.type ENUM to include 'personal' with lowercase values.")
            except Exception as e:
                print(f"Skipping spaces.type ENUM migration: {e}")

        # 1. Initialize root user
        root_exists = db.scalar(
            select(User).where((User.username == settings.ROOT_USERNAME) | (User.is_root == True))
        )
        if not root_exists:
            if not settings.ROOT_PASSWORD or len(settings.ROOT_PASSWORD) < 12:
                print("错误：请在 .env 中设置不低于 12 位的 ROOT_PASSWORD。")
                return

            root_user = User(
                username=settings.ROOT_USERNAME,
                email=settings.ROOT_EMAIL or "admin@example.com",
                password=hash_password(settings.ROOT_PASSWORD),
                display_name="超级管理员",
                is_root=True,
                is_active=True,
                is_discipline_authorized=True,
            )
            db.add(root_user)
            print(f"成功创建超级管理员账户：{settings.ROOT_USERNAME}")
        else:
            print("超级管理员账户已存在，跳过创建。")
            if root_exists and not root_exists.is_discipline_authorized:
                root_exists.is_discipline_authorized = True
                print("Enabled discipline permission for root user.")

        # 2. Initialize storage quota
        quota_exists = db.scalar(select(StorageQuota))
        if not quota_exists:
            quota = StorageQuota(
                max_size_mb=1024.0,
                used_size_mb=0.0,
            )
            db.add(quota)
            print("初始化默认存储配额：1024 MB")
        else:
            print("存储配额已存在，跳过初始化。")

        # 3. Initialize default system configs
        import json
        modelscope_key_enc = encrypt_value("ms-cd1c3de7-b885-4c53-b2a1-9404d47480bb")
        qwen_key_enc = encrypt_value("sk-03967b5aef294262a5da3346bb5f4ca8")
        deepseek_key_enc = encrypt_value("sk-733c49696e974e1a9d60beaacf55ca77")

        providers = [
            {
                "id": "modelscope",
                "name": "ModelScope",
                "base_url": "https://api-inference.modelscope.cn/v1/",
                "api_key": modelscope_key_enc,
                "model": "Qwen/Qwen3.5-35B-A3B",
                "models": [
                    "Qwen/Qwen3.5-35B-A3B",
                    "Qwen/Qwen3-VL-235B-A22B-Instruct",
                    "Qwen/Qwen3.5-27B",
                    "Qwen/Qwen3.5-397B-A17B"
                ],
                "is_reachable": True
            },
            {
                "id": "qwen",
                "name": "系统Agent API",
                "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
                "api_key": qwen_key_enc,
                "model": "qwen-vl-max",
                "models": [
                    "qwen-vl-max",
                    "qwen-plus"
                ],
                "is_reachable": True
            }
        ]
        providers_json = json.dumps(providers, ensure_ascii=False)

        default_configs = [
            ("site_name", "Lumino", "站点名称"),
            ("qwen_api_key", qwen_key_enc, "通义千问 API Key，加密存储"),
            ("qwen_base_url", "https://www.inroi.shop/v1", "通义千问接口地址"),
            ("deepseek_api_key", deepseek_key_enc, "DeepSeek API Key，加密存储"),
            ("deepseek_base_url", "https://api.deepseek.com", "DeepSeek 接口地址"),
            ("default_model", "deepseek", "默认模型 ID（例如 deepseek 或 deepseek:deepseek-chat）"),
            ("chat_daily_limit", "20", "普通用户每日聊天消息次数限制"),
            (
                "lsky_api_url",
                settings.LSKY_API_URL or "http://114.55.55.110:40027/api",
                "lsky-pro API 地址",
            ),
            ("lsky_api_token", "", "lsky-pro Token，加密存储"),
            ("storage_quota_mb", "1024", "相册存储配额 MB"),
            ("ai_providers", providers_json, "可用的 AI 服务商配置，包含模型列表、Key、Base URL 等"),
        ]

        for key, val, desc in default_configs:
            cfg = db.scalar(select(SystemConfig).where(SystemConfig.config_key == key))
            if not cfg:
                cfg = SystemConfig(
                    config_key=key,
                    config_val=val,
                    description=desc,
                )
                db.add(cfg)
                print(f"初始化配置项 {key}")
            else:
                # Overwrite keys/urls if they differ to make sure our provided keys are registered
                if key in ("qwen_api_key", "qwen_base_url", "deepseek_api_key", "deepseek_base_url", "ai_providers") or not cfg.config_val:
                    cfg.config_val = val
                    print(f"更新配置项 {key}")

        db.commit()
        print("数据库初始化完成！")
    except Exception as e:
        db.rollback()
        print(f"数据库初始化出错: {e}")
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
