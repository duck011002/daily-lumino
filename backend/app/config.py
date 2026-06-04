from functools import lru_cache
from urllib.parse import quote_plus

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DB_HOST: str
    DB_PORT: int = 13306
    DB_USER: str
    DB_PASSWORD: str
    DB_NAME: str = "lumino"

    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    REDIS_URL: str = "redis://127.0.0.1:6379/0"

    ROOT_USERNAME: str = "admin"
    ROOT_EMAIL: str = ""
    ROOT_PASSWORD: str = ""

    LSKY_API_URL: str = ""
    LSKY_API_TOKEN: str = ""

    FRONTEND_ORIGINS: str = "http://localhost:3000"
    APP_ENV: str = "development"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def database_url(self) -> str:
        escaped_user = quote_plus(self.DB_USER)
        escaped_password = quote_plus(self.DB_PASSWORD)
        return (
            f"mysql+pymysql://{escaped_user}:{escaped_password}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?charset=utf8mb4"
        )

    @property
    def cors_origins(self) -> list[str]:
        return [item.strip() for item in self.FRONTEND_ORIGINS.split(",") if item.strip()]

    @property
    def cookie_secure(self) -> bool:
        return self.APP_ENV == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
