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
            )
            db.add(root_user)
            print(f"成功创建超级管理员账户：{settings.ROOT_USERNAME}")
        else:
            print("超级管理员账户已存在，跳过创建。")

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
        qwen_key_enc = encrypt_value("sk-ce6e4d7dcd7780a1e0cec8305d5893a4973c1cd6e28137b35bd06a28c42e5bb4")
        deepseek_key_enc = encrypt_value("sk-733c49696e974e1a9d60beaacf55ca77")

        default_configs = [
            ("site_name", "Lumino", "站点名称"),
            ("qwen_api_key", qwen_key_enc, "通义千问 API Key，加密存储"),
            ("qwen_base_url", "https://www.inroi.shop/v1", "通义千问接口地址"),
            ("deepseek_api_key", deepseek_key_enc, "DeepSeek API Key，加密存储"),
            ("deepseek_base_url", "https://api.deepseek.com", "DeepSeek 接口地址"),
            ("default_model", "qwen", "默认模型 qwen 或 deepseek"),
            (
                "lsky_api_url",
                settings.LSKY_API_URL or "http://114.55.55.110:40027/api",
                "lsky-pro API 地址",
            ),
            ("lsky_api_token", "", "lsky-pro Token，加密存储"),
            ("storage_quota_mb", "1024", "相册存储配额 MB"),
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
                if key in ("qwen_api_key", "qwen_base_url", "deepseek_api_key", "deepseek_base_url") or not cfg.config_val:
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
