# Lumino · 实施文档 v1.1（Codex 可执行版）

> 基于设计文档 v0.1 与实施文档 v1.0 调整。  
> 数据库：`114.55.55.110:13306`  
> 服务器：阿里云 2h2g Ubuntu + 1Panel  
> 目标：把 Lumino 做成可部署、可阶段验收、可持续迭代的 FastAPI + Next.js 私密生活空间应用。

---

## 0. 给 Codex 的总规则

这份文档是给 Codex / 代码 Agent 执行的实施文档，不是单纯说明文档。Codex 必须严格按阶段推进。

### 0.1 全局执行原则

1. **按阶段实现**，不要一次性实现全部模块。每个阶段完成后必须自测并输出结果。
2. **禁止留下 TODO、pass、伪代码、空函数、未接线页面、假数据接口**。
3. **禁止修改本文档指定的核心技术路线**，除非明确说明原因并给出兼容方案。
4. **必须生成 `.env.example`，真实 `.env` 不提交 git**。
5. **必须生成 `.gitignore`**，至少忽略：`.env`、`.env.local`、`venv/`、`node_modules/`、`.next/`、`__pycache__/`、`.pytest_cache/`、`dist/`。
6. **所有后端正式接口必须有 Pydantic Schema**，禁止用 `body: dict` 作为最终正式实现。
7. **所有涉及空间、相册、笔记、博客的接口必须做权限校验**，不能只校验登录。
8. **所有数据库结构变更必须经过 Alembic migration**。允许保留完整 SQL 作为 1Panel 手动建表备用方案。
9. **后端使用 SQLAlchemy 2.x 兼容写法**，禁止使用 `Query.get()`，应使用 `db.get(Model, id)` 或 `select()`。
10. **前端固定使用 Next.js 14 + React 18 + Tailwind CSS 3**，不要使用 latest 自动升级到不兼容版本。
11. 每个阶段结束必须输出：
    - 新增 / 修改文件列表；
    - 启动命令；
    - 测试命令；
    - 已完成项；
    - 未进入本阶段的功能；
    - 已知风险或待确认项。

### 0.2 当前推荐 Codex 执行方式

不要把“全部功能一次性实现”作为单个任务。建议按以下方式逐轮给 Codex：

```text
请只实现阶段 1，不要做阶段 2 之后的功能。完成后运行测试并说明结果。
```

阶段 1 完成、可运行后，再让 Codex 继续阶段 2、阶段 3，以此类推。

---

## 1. 技术栈与版本约束

### 1.1 后端

| 项目 | 版本 / 说明 |
|---|---|
| Python | 3.11 |
| Web 框架 | FastAPI |
| ASGI | uvicorn[standard] |
| ORM | SQLAlchemy 2.x |
| Migration | Alembic |
| MySQL Driver | pymysql |
| 配置管理 | pydantic-settings + python-dotenv |
| 鉴权 | JWT + HttpOnly Cookie |
| 密码哈希 | passlib[bcrypt] |
| HTTP Client | httpx |
| LLM SDK | openai Python SDK，兼容 Qwen / DeepSeek OpenAI-style API |
| Redis | redis-py，主要用于后续缓存 / 会话 / 限流扩展 |
| 测试 | pytest + httpx AsyncClient 或 TestClient |
| 代码质量 | ruff + black，至少保证基础格式与 import 整理 |

### 1.2 前端

| 项目 | 版本 / 说明 |
|---|---|
| Node.js | 20 LTS |
| Next.js | 14.2.x |
| React | 18.3.x |
| Tailwind CSS | 3.4.x |
| TypeScript | 5.x |
| 请求库 | axios + fetch SSE |
| 主题 | next-themes |
| UI 基础 | Radix UI + lucide-react |
| Markdown 编辑器 | @uiw/react-md-editor |
| PWA | next-pwa |
| 相册预览 | react-image-gallery |

### 1.3 数据库与部署

| 项目 | 说明 |
|---|---|
| MySQL | 已有远程 MySQL，端口 `13306` |
| Redis | Docker / 1Panel 安装均可 |
| 进程管理 | PM2 同时守护前端与后端 |
| 反向代理 | 1Panel OpenResty / Nginx |
| 部署路径 | `/opt/lumino` |

---

## 2. 数据库连接与环境变量

> 以下数据库信息按当前项目实际情况保留。真实项目中 `.env` 不提交 git。

### 2.1 backend/.env

```ini
# 数据库
DB_HOST=114.55.55.110
DB_PORT=13306
DB_USER=username
DB_PASSWORD=134679werLQ@
DB_NAME=lumino

# JWT
JWT_SECRET=在这里填一个随机64位字符串
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=120
REFRESH_TOKEN_EXPIRE_DAYS=7

# Redis
REDIS_URL=redis://127.0.0.1:6379/0

# Root 账号初始化，init_db.py 运行一次后可以保留，也可以从生产环境删除
ROOT_USERNAME=admin
ROOT_EMAIL=your@email.com
ROOT_PASSWORD=你的强密码至少12位

# lsky-pro，后续也可从 system_configs 表读取
LSKY_API_URL=http://114.55.55.110:40027/api
LSKY_API_TOKEN=从 lsky-pro 管理面板 Token 里复制

# CORS
FRONTEND_ORIGINS=http://localhost:3000,http://114.55.55.110:3000,http://114.55.55.110

# 运行环境：development / production
APP_ENV=development
```

### 2.2 backend/.env.example

Codex 必须同时生成 `.env.example`，格式如下：

```ini
DB_HOST=your-db-host
DB_PORT=13306
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_NAME=lumino

JWT_SECRET=replace-with-random-64-chars
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=120
REFRESH_TOKEN_EXPIRE_DAYS=7

REDIS_URL=redis://127.0.0.1:6379/0

ROOT_USERNAME=admin
ROOT_EMAIL=admin@example.com
ROOT_PASSWORD=replace-with-strong-password

LSKY_API_URL=http://your-host:40027/api
LSKY_API_TOKEN=replace-with-token

FRONTEND_ORIGINS=http://localhost:3000
APP_ENV=development
```

### 2.3 frontend/.env.local

```ini
NEXT_PUBLIC_API_BASE=/api
```

---

## 3. 完整目录结构

```text
lumino/
├── backend/
│   ├── alembic/
│   │   ├── versions/
│   │   ├── env.py
│   │   └── script.py.mako
│   ├── alembic.ini
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── dependencies.py
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── invite_code.py
│   │   │   ├── space.py
│   │   │   ├── chat.py
│   │   │   ├── album.py
│   │   │   ├── storage_quota.py
│   │   │   ├── location_pin.py
│   │   │   ├── note.py
│   │   │   ├── blog.py
│   │   │   └── system_config.py
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── auth.py
│   │   │   ├── space.py
│   │   │   ├── chat.py
│   │   │   ├── album.py
│   │   │   ├── note.py
│   │   │   ├── blog.py
│   │   │   └── admin.py
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── admin.py
│   │   │   ├── chat.py
│   │   │   ├── spaces.py
│   │   │   ├── albums.py
│   │   │   ├── notes.py
│   │   │   └── blog.py
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── llm.py
│   │   │   ├── lsky.py
│   │   │   ├── storage.py
│   │   │   └── permissions.py
│   │   └── utils/
│   │       ├── __init__.py
│   │       └── crypto.py
│   ├── scripts/
│   │   └── init_db.py
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_health.py
│   │   └── test_auth.py
│   ├── requirements.txt
│   ├── pyproject.toml
│   ├── .env.example
│   └── .env
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── globals.css
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── chat/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── spaces/
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx
│   │   │   │       ├── albums/page.tsx
│   │   │   │       ├── notes/page.tsx
│   │   │   │       └── notes/[nid]/page.tsx
│   │   │   ├── blog/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [slug]/page.tsx
│   │   │   └── admin/page.tsx
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Navbar.tsx
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   └── ThemeToggle.tsx
│   │   │   ├── chat/
│   │   │   │   ├── ChatWindow.tsx
│   │   │   │   ├── MessageBubble.tsx
│   │   │   │   └── ChatInput.tsx
│   │   │   ├── spaces/
│   │   │   │   ├── SpaceCard.tsx
│   │   │   │   └── MemberList.tsx
│   │   │   ├── album/
│   │   │   │   ├── PhotoGrid.tsx
│   │   │   │   └── PhotoViewer.tsx
│   │   │   ├── note/
│   │   │   │   └── NoteEditor.tsx
│   │   │   ├── blog/
│   │   │   │   └── PostCard.tsx
│   │   │   └── ui/
│   │   │       ├── Button.tsx
│   │   │       ├── Modal.tsx
│   │   │       ├── Avatar.tsx
│   │   │       └── Badge.tsx
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   └── useTheme.ts
│   │   ├── lib/
│   │   │   ├── api.ts
│   │   │   └── utils.ts
│   │   └── types/
│   │       └── index.ts
│   ├── public/
│   │   ├── icons/
│   │   │   ├── icon-192.png
│   │   │   └── icon-512.png
│   │   └── manifest.json
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── package.json
│   └── .env.local
│
├── docker-compose.yml
├── ecosystem.config.js
├── README.md
└── .gitignore
```

---

## 4. 数据库设计与完整建表 SQL

### 4.1 设计要求

1. 所有表使用 `utf8mb4`。
2. 所有关联字段必须建立索引。
3. 核心关联必须加外键。
4. 删除空间时，空间成员、相册、照片、位置、笔记应级联删除。
5. 删除用户不建议物理删除，业务上优先设置 `is_active=0`。
6. `system_configs.config_val` 中存储 API Key 时，业务层必须加密后写入。
7. Alembic migration 是主方案；下面 SQL 是 1Panel 手动初始化备用方案。

### 4.2 完整 SQL

```sql
CREATE DATABASE IF NOT EXISTS lumino CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE lumino;

CREATE TABLE users (
  id           BIGINT PRIMARY KEY AUTO_INCREMENT,
  username     VARCHAR(50)  NOT NULL,
  email        VARCHAR(100) NOT NULL,
  password     VARCHAR(255) NOT NULL,
  avatar_url   VARCHAR(500) DEFAULT NULL,
  display_name VARCHAR(100) DEFAULT NULL,
  is_root      TINYINT(1)   DEFAULT 0,
  is_active    TINYINT(1)   DEFAULT 1,
  created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_username (username),
  UNIQUE KEY uq_email (email),
  KEY idx_users_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE invite_codes (
  id           BIGINT PRIMARY KEY AUTO_INCREMENT,
  code         VARCHAR(32)  NOT NULL,
  created_by   BIGINT       NOT NULL,
  used_by      BIGINT       DEFAULT NULL,
  expires_at   DATETIME     DEFAULT NULL,
  used_at      DATETIME     DEFAULT NULL,
  created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_code (code),
  KEY idx_created_by (created_by),
  KEY idx_used_by (used_by),
  CONSTRAINT fk_invite_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_invite_used_by FOREIGN KEY (used_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE spaces (
  id           BIGINT PRIMARY KEY AUTO_INCREMENT,
  name         VARCHAR(100) NOT NULL,
  type         ENUM('couple','family','friends') NOT NULL,
  description  TEXT         DEFAULT NULL,
  cover_url    VARCHAR(500) DEFAULT NULL,
  created_by   BIGINT       NOT NULL,
  created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
  KEY idx_created_by (created_by),
  CONSTRAINT fk_spaces_created_by FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE space_members (
  id           BIGINT PRIMARY KEY AUTO_INCREMENT,
  space_id     BIGINT       NOT NULL,
  user_id      BIGINT       NOT NULL,
  role         ENUM('owner','member') DEFAULT 'member',
  joined_at    DATETIME     DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_space_user (space_id, user_id),
  KEY idx_user_id (user_id),
  CONSTRAINT fk_space_members_space FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE,
  CONSTRAINT fk_space_members_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE chat_sessions (
  id           BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id      BIGINT       NOT NULL,
  title        VARCHAR(200) DEFAULT '新对话',
  model        ENUM('qwen','deepseek') DEFAULT 'qwen',
  created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_chat_sessions_user_id (user_id),
  CONSTRAINT fk_chat_sessions_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE chat_messages (
  id           BIGINT PRIMARY KEY AUTO_INCREMENT,
  session_id   BIGINT       NOT NULL,
  role         ENUM('user','assistant','system') NOT NULL,
  content      TEXT         NOT NULL,
  attachments  JSON         DEFAULT NULL,
  tokens_used  INT          DEFAULT 0,
  created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
  KEY idx_chat_messages_session_id (session_id),
  CONSTRAINT fk_chat_messages_session FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE albums (
  id           BIGINT PRIMARY KEY AUTO_INCREMENT,
  space_id     BIGINT       NOT NULL,
  name         VARCHAR(200) NOT NULL,
  cover_url    VARCHAR(500) DEFAULT NULL,
  created_by   BIGINT       NOT NULL,
  created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
  KEY idx_albums_space_id (space_id),
  KEY idx_albums_created_by (created_by),
  CONSTRAINT fk_albums_space FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE,
  CONSTRAINT fk_albums_created_by FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE photos (
  id           BIGINT PRIMARY KEY AUTO_INCREMENT,
  album_id     BIGINT       NOT NULL,
  space_id     BIGINT       NOT NULL,
  uploader_id  BIGINT       NOT NULL,
  url          VARCHAR(500) NOT NULL,
  thumb_url    VARCHAR(500) DEFAULT NULL,
  caption      TEXT         DEFAULT NULL,
  taken_at     DATETIME     DEFAULT NULL,
  file_size_kb INT          DEFAULT 0,
  created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
  KEY idx_photos_album_id (album_id),
  KEY idx_photos_space_id (space_id),
  KEY idx_photos_uploader_id (uploader_id),
  CONSTRAINT fk_photos_album FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
  CONSTRAINT fk_photos_space FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE,
  CONSTRAINT fk_photos_uploader FOREIGN KEY (uploader_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE storage_quota (
  id           BIGINT PRIMARY KEY AUTO_INCREMENT,
  max_size_mb  DECIMAL(12,2) DEFAULT 1024,
  used_size_mb DECIMAL(12,2) DEFAULT 0,
  updated_at   DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO storage_quota (max_size_mb, used_size_mb)
SELECT 1024, 0
WHERE NOT EXISTS (SELECT 1 FROM storage_quota LIMIT 1);

CREATE TABLE location_pins (
  id           BIGINT PRIMARY KEY AUTO_INCREMENT,
  space_id     BIGINT       NOT NULL,
  user_id      BIGINT       NOT NULL,
  city         VARCHAR(100) DEFAULT NULL,
  longitude    DECIMAL(10,7) DEFAULT NULL,
  latitude     DECIMAL(10,7) DEFAULT NULL,
  label        VARCHAR(100) DEFAULT NULL,
  updated_at   DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_location_space_user (space_id, user_id),
  KEY idx_location_user_id (user_id),
  CONSTRAINT fk_location_space FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE,
  CONSTRAINT fk_location_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE notes (
  id           BIGINT PRIMARY KEY AUTO_INCREMENT,
  space_id     BIGINT       NOT NULL,
  title        VARCHAR(300) NOT NULL,
  content      LONGTEXT     DEFAULT NULL,
  cover_url    VARCHAR(500) DEFAULT NULL,
  author_id    BIGINT       NOT NULL,
  lock_by      BIGINT       DEFAULT NULL,
  lock_at      DATETIME     DEFAULT NULL,
  is_published TINYINT(1)   DEFAULT 1,
  created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_notes_space_id (space_id),
  KEY idx_notes_author_id (author_id),
  KEY idx_notes_lock_by (lock_by),
  CONSTRAINT fk_notes_space FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE,
  CONSTRAINT fk_notes_author FOREIGN KEY (author_id) REFERENCES users(id),
  CONSTRAINT fk_notes_lock_by FOREIGN KEY (lock_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE blog_posts (
  id           BIGINT PRIMARY KEY AUTO_INCREMENT,
  title        VARCHAR(300) NOT NULL,
  slug         VARCHAR(300) NOT NULL,
  content      LONGTEXT     NOT NULL,
  cover_url    VARCHAR(500) DEFAULT NULL,
  excerpt      TEXT         DEFAULT NULL,
  is_public    TINYINT(1)   DEFAULT 0,
  is_published TINYINT(1)   DEFAULT 0,
  tags         JSON         DEFAULT NULL,
  author_id    BIGINT       NOT NULL,
  view_count   INT          DEFAULT 0,
  published_at DATETIME     DEFAULT NULL,
  created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_blog_slug (slug),
  KEY idx_blog_public_published (is_public, is_published),
  KEY idx_blog_author_id (author_id),
  CONSTRAINT fk_blog_author FOREIGN KEY (author_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE system_configs (
  id           BIGINT PRIMARY KEY AUTO_INCREMENT,
  config_key   VARCHAR(100) NOT NULL,
  config_val   TEXT         DEFAULT NULL,
  description  VARCHAR(300) DEFAULT NULL,
  updated_by   BIGINT       DEFAULT NULL,
  updated_at   DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_system_config_key (config_key),
  KEY idx_system_config_updated_by (updated_by),
  CONSTRAINT fk_system_config_updated_by FOREIGN KEY (updated_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO system_configs (config_key, description) VALUES
  ('site_name',        '站点名称'),
  ('qwen_api_key',     '通义千问 API Key，加密存储'),
  ('qwen_base_url',    '通义千问接口地址，默认 https://dashscope.aliyuncs.com/compatible-mode/v1'),
  ('deepseek_api_key', 'DeepSeek API Key，加密存储'),
  ('deepseek_base_url','DeepSeek 接口地址，默认 https://api.deepseek.com/v1'),
  ('default_model',    '默认模型 qwen 或 deepseek'),
  ('lsky_api_url',     'lsky-pro API 地址'),
  ('lsky_api_token',   'lsky-pro Token，加密存储'),
  ('storage_quota_mb', '相册存储配额 MB')
ON DUPLICATE KEY UPDATE description = VALUES(description);
```

---

## 5. 后端实施细节

### 5.1 后端依赖安装

```bash
cd backend
python3.11 -m venv venv
source venv/bin/activate
pip install fastapi uvicorn[standard] sqlalchemy alembic pymysql cryptography \
            python-jose[cryptography] passlib[bcrypt] python-multipart \
            httpx python-dotenv openai redis pydantic-settings pytest ruff black
pip freeze > requirements.txt
```

### 5.2 pyproject.toml

```toml
[tool.black]
line-length = 100
target-version = ["py311"]

[tool.ruff]
line-length = 100
target-version = "py311"

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B"]
ignore = []
```

### 5.3 app/config.py

```python
from functools import lru_cache
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

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def database_url(self) -> str:
        return (
            f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}"
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
```

### 5.4 app/database.py

```python
from collections.abc import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session
from app.config import settings


engine = create_engine(
    settings.database_url,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    echo=False,
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

### 5.5 ORM Models 要求

Codex 必须完整实现以下模型，字段、约束、索引、外键与 SQL 保持一致：

```text
User
InviteCode
Space
SpaceMember
ChatSession
ChatMessage
Album
Photo
StorageQuota
LocationPin
Note
BlogPost
SystemConfig
```

要求：

1. 使用 SQLAlchemy 2.x 风格，优先使用 `Mapped[]` 与 `mapped_column()`。
2. JSON 字段使用 SQLAlchemy `JSON` 类型。
3. 枚举字段可以先用 SQLAlchemy `Enum`，枚举值必须与 SQL 一致。
4. `created_at` 使用 `server_default=func.now()`。
5. `updated_at` 使用 `server_default=func.now(), onupdate=func.now()` 或等价实现。
6. `models/__init__.py` 必须统一导入所有模型，供 Alembic 自动发现。

示例风格：

```python
from sqlalchemy import BigInteger, String, Boolean, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    password: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    display_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_root: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
```

### 5.6 Alembic 要求

初始化：

```bash
cd backend
alembic init alembic
```

`alembic/env.py` 必须加载：

```python
from app.database import Base
from app import models  # noqa: F401，确保所有模型被导入
from app.config import settings

target_metadata = Base.metadata
```

迁移命令：

```bash
alembic revision --autogenerate -m "init schema"
alembic upgrade head
```

要求：

1. 第一版 migration 必须能创建完整表结构。
2. README 写清楚 `alembic upgrade head`。
3. `scripts/init_db.py` 不负责建表，只负责写 root 账号和必要默认配置。

### 5.7 Auth 服务

#### 5.7.1 services/auth.py

必须实现：

```text
hash_password(password)
verify_password(plain, hashed)
create_access_token(user_id, is_root)
create_refresh_token(user_id)
decode_token(token)
```

要求：

1. JWT payload 至少包含：`sub`、`type`、`exp`、`is_root`。
2. access token 类型是 `access`。
3. refresh token 类型是 `refresh`。
4. 解析 token 时必须校验 type。

#### 5.7.2 Cookie 策略

登录成功后写入：

```text
access_token: HttpOnly, SameSite=Lax, Secure=生产环境 true, Max-Age=ACCESS_TOKEN_EXPIRE_MINUTES
refresh_token: HttpOnly, SameSite=Lax, Secure=生产环境 true, Max-Age=REFRESH_TOKEN_EXPIRE_DAYS
```

退出登录时清除两个 Cookie。

### 5.8 Auth 路由

必须实现以下接口：

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/register` | 注册，必要时校验邀请码 |
| POST | `/api/auth/login` | 登录，写 Cookie |
| POST | `/api/auth/refresh` | 用 refresh token 换 access token |
| POST | `/api/auth/logout` | 清除 Cookie |
| GET | `/api/auth/me` | 当前登录用户 |

#### 5.8.1 注册规则

1. username 唯一。
2. email 唯一。
3. password 至少 8 位，生产建议 12 位。
4. 注册后默认 `is_root=false`、`is_active=true`。
5. 如果后续启用邀请码，则邀请码必须存在、未使用、未过期。

#### 5.8.2 登录规则

1. 支持 username 或 email 登录。
2. 用户不存在、密码错误统一返回 401，避免暴露用户是否存在。
3. `is_active=0` 不允许登录。

### 5.9 dependencies.py

必须实现：

```text
get_current_user
require_root
require_space_member
require_space_owner
```

`require_space_member` 用于空间、相册、笔记访问控制。  
`require_space_owner` 用于成员管理、删除空间等危险操作。

### 5.10 LLM 服务

#### 5.10.1 模型配置来源

优先从 `system_configs` 读取：

```text
qwen_api_key
qwen_base_url
deepseek_api_key
deepseek_base_url
default_model
```

如果数据库没有配置，可以回退到 `.env`，但最终管理入口应在超管面板。

#### 5.10.2 支持模型

| model | 实际模型名 | 说明 |
|---|---|---|
| qwen | qwen-vl-max 或后续配置值 | 支持图片多模态 |
| deepseek | deepseek-chat | 仅文本 |

规则：

1. 如果 `model=deepseek` 且 attachments 包含图片，必须返回 400，提示 DeepSeek 当前模式不支持图片。
2. 如果 `model=qwen` 且有图片，按 OpenAI-compatible 多模态消息格式构造。
3. 聊天上下文默认只取最近 10 条消息。
4. SSE 输出格式统一为：

```text
data: {"delta":"..."}

data: {"error":"..."}

data: [DONE]
```

### 5.11 Chat 路由

必须实现：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/chat/sessions` | 获取当前用户会话列表 |
| POST | `/api/chat/sessions` | 创建会话 |
| GET | `/api/chat/sessions/{session_id}` | 获取会话详情与消息 |
| DELETE | `/api/chat/sessions/{session_id}` | 删除会话 |
| POST | `/api/chat/sessions/{session_id}/messages` | 发送消息并 SSE 流式返回 |

要求：

1. 只能访问自己的会话。
2. 发送消息前先保存用户消息。
3. 流式完成后保存 assistant 消息。
4. 如果会话标题是“新对话”，用首条用户消息前 20 字更新标题。
5. 异常时返回 SSE error，并不要写入空 assistant 消息。

### 5.12 lsky-pro 上传服务

必须实现：

```text
get_lsky_config(db)
upload_image(file_bytes, filename, content_type, file_size_kb, db)
```

要求：

1. 上传前检查全局存储配额。
2. 只允许图片类型：jpg、jpeg、png、webp、gif。
3. 单张图片大小建议限制为 10MB。
4. 上传成功后更新 `storage_quota.used_size_mb`。
5. 上传失败必须把 lsky 返回的 message 写入异常信息，但不要泄露 token。
6. 生产环境建议加图片压缩，这一项可放到 v1.1 后续优化。

### 5.13 Spaces 路由

必须实现：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/spaces` | 当前用户加入的空间列表 |
| POST | `/api/spaces` | 创建空间，创建者自动成为 owner |
| GET | `/api/spaces/{space_id}` | 空间详情 |
| PATCH | `/api/spaces/{space_id}` | 更新空间，仅 owner |
| DELETE | `/api/spaces/{space_id}` | 删除空间，仅 owner |
| GET | `/api/spaces/{space_id}/members` | 成员列表 |
| POST | `/api/spaces/{space_id}/members` | 添加成员，仅 owner |
| DELETE | `/api/spaces/{space_id}/members/{user_id}` | 移除成员，仅 owner |
```

空间类型：

```text
couple
family
friends
```

### 5.14 Albums / Photos 路由

必须实现：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/spaces/{space_id}/albums` | 相册列表 |
| POST | `/api/spaces/{space_id}/albums` | 创建相册 |
| GET | `/api/spaces/{space_id}/albums/{album_id}` | 相册详情 |
| PATCH | `/api/spaces/{space_id}/albums/{album_id}` | 更新相册 |
| DELETE | `/api/spaces/{space_id}/albums/{album_id}` | 删除相册 |
| POST | `/api/spaces/{space_id}/albums/{album_id}/photos` | 上传照片 |
| GET | `/api/spaces/{space_id}/albums/{album_id}/photos` | 照片列表 |
| DELETE | `/api/spaces/{space_id}/albums/{album_id}/photos/{photo_id}` | 删除照片 |

要求：

1. 所有接口必须校验当前用户是空间成员。
2. 删除相册会级联删除照片数据库记录，但不会自动删除 lsky 文件；v1.0 可以只删数据库记录。
3. 删除照片同理，v1.0 先只删数据库记录和减少 quota；后续可接 lsky 删除接口。

### 5.15 Notes 路由与编辑锁

必须实现：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/spaces/{space_id}/notes` | 笔记列表 |
| POST | `/api/spaces/{space_id}/notes` | 创建笔记 |
| GET | `/api/spaces/{space_id}/notes/{note_id}` | 笔记详情 |
| PATCH | `/api/spaces/{space_id}/notes/{note_id}` | 保存笔记 |
| DELETE | `/api/spaces/{space_id}/notes/{note_id}` | 删除笔记 |
| POST | `/api/spaces/{space_id}/notes/{note_id}/lock` | 获取编辑锁 |
| DELETE | `/api/spaces/{space_id}/notes/{note_id}/lock` | 释放编辑锁 |
| POST | `/api/spaces/{space_id}/notes/{note_id}/heartbeat` | 锁心跳 |

锁规则：

1. 锁超时时间 30 分钟。
2. 前端编辑时每 5 分钟 heartbeat。
3. 如果锁被他人持有且未超时，返回 409，并返回持有人昵称。
4. 如果锁超时，其他人可以抢锁。
5. 保存笔记时必须校验：未锁、自己持锁、或锁已超时。

关键代码必须避免 `Query.get()`：

```python
locked_user = db.get(User, note.lock_by)
```

### 5.16 Blog 路由

必须实现：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/blog/posts` | 公开文章列表 |
| GET | `/api/blog/posts/{slug}` | 公开文章详情 |
| GET | `/api/admin/blog/posts` | 管理端文章列表，仅 root |
| POST | `/api/admin/blog/posts` | 新建文章，仅 root |
| PATCH | `/api/admin/blog/posts/{id}` | 更新文章，仅 root |
| DELETE | `/api/admin/blog/posts/{id}` | 删除文章，仅 root |

要求：

1. 访客只能看到 `is_public=1` 且 `is_published=1` 的文章。
2. root 可以管理全部文章。
3. slug 必须唯一。
4. 访问公开详情时 `view_count + 1`。

### 5.17 Admin 路由

必须实现：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/admin/users` | 用户列表 |
| PATCH | `/api/admin/users/{user_id}` | 启用 / 禁用用户 |
| GET | `/api/admin/configs` | 系统配置列表 |
| PATCH | `/api/admin/configs/{key}` | 更新配置 |
| POST | `/api/admin/invite-codes` | 创建邀请码 |
| GET | `/api/admin/invite-codes` | 邀请码列表 |
| GET | `/api/admin/storage-quota` | 查看配额 |
| PATCH | `/api/admin/storage-quota` | 修改配额 |

要求：

1. 全部接口 `require_root`。
2. API Key、Token 类配置必须加密存储。
3. 返回配置时敏感值只返回脱敏文本，例如 `sk-****abcd`。

### 5.18 main.py

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import auth, admin, chat, spaces, albums, notes, blog

app = FastAPI(title="Lumino API", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(chat.router)
app.include_router(spaces.router)
app.include_router(albums.router)
app.include_router(notes.router)
app.include_router(blog.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "app": "Lumino"}
```

### 5.19 scripts/init_db.py

职责：

1. 检查 root 是否存在。
2. 如果不存在，读取 `.env` 中 root 配置，bcrypt hash 后写入。
3. 初始化默认 `storage_quota` 与 `system_configs`，如果已存在则跳过。
4. 可重复执行，不产生重复 root。

不负责：

1. 不负责建表。
2. 不直接 drop / truncate 数据。
3. 不重置已有 root 密码，除非显式加命令参数。

---

## 6. 后端测试要求

阶段 1 至少实现：

```text
tests/test_health.py
tests/test_auth.py
```

### 6.1 test_health.py

必须覆盖：

```text
GET /api/health 返回 200
返回 JSON 中 status=ok
```

### 6.2 test_auth.py

必须覆盖：

```text
注册成功
重复 username 失败
重复 email 失败
登录成功并设置 cookie
错误密码登录失败
GET /api/auth/me 成功
logout 后 me 返回 401
refresh 可刷新 access token
```

### 6.3 测试命令

```bash
cd backend
source venv/bin/activate
pytest
ruff check .
black --check .
```

---

## 7. 前端实施细节

### 7.1 初始化项目

```bash
npx create-next-app@14 frontend --typescript --tailwind --eslint --app --src-dir
cd frontend
npm install axios react-markdown @uiw/react-md-editor next-themes
npm install next-pwa
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu
npm install lucide-react react-image-gallery
```

要求在 `package.json` 中固定版本大类：

```json
{
  "dependencies": {
    "next": "14.2.x",
    "react": "18.3.x",
    "react-dom": "18.3.x",
    "tailwindcss": "3.4.x"
  }
}
```

如果实际安装不支持 `x` 写法，Codex 应自动改成当前 14.2 / 18.3 / 3.4 的具体 patch 版本。

### 7.2 next.config.ts

```typescript
import withPWAInit from 'next-pwa'
import type { NextConfig } from 'next'

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
})

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:8000/api/:path*',
      },
    ]
  },
}

export default withPWA(nextConfig)
```

### 7.3 tailwind.config.ts

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#E8814A',
        secondary: '#F5E6D3',
        surface: '#FAFAF8',
        onSurface: '#1C1917',
        darkBg: '#161614',
        darkCard: '#1E1E1B',
        darkBorder: '#2E2E2B',
      },
      fontFamily: {
        sans: ['var(--font-outfit)', 'sans-serif'],
        display: ['var(--font-playfair)', 'serif'],
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
      },
    },
  },
  plugins: [],
}

export default config
```

### 7.4 layout.tsx

```tsx
import type { Metadata } from 'next'
import { Outfit, Playfair_Display } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import './globals.css'

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' })

export const metadata: Metadata = {
  title: 'Lumino',
  description: '你的私密生活空间',
  manifest: '/manifest.json',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={`${outfit.variable} ${playfair.variable} font-sans`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

### 7.5 lib/api.ts

```typescript
import axios from 'axios'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE || '/api',
  withCredentials: true,
  timeout: 30000,
})

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config
    if (err.response?.status === 401 && !originalRequest?._retry) {
      originalRequest._retry = true
      try {
        await axios.post('/api/auth/refresh', {}, { withCredentials: true })
        return api.request(originalRequest)
      } catch {
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(err)
  }
)

export default api
```

### 7.6 前端页面要求

#### 7.6.1 访客主页 `/`

包含：

1. Lumino 品牌介绍。
2. 登录 / 注册按钮。
3. 功能入口展示：AI 聊天、私密空间、相册、Markdown 记录、博客。
4. 支持亮暗色。

#### 7.6.2 登录页 `/login`

包含：

1. username/email 输入。
2. password 输入。
3. 登录按钮。
4. 登录成功跳转 `/dashboard`。
5. 错误提示。

#### 7.6.3 注册页 `/register`

包含：

1. username。
2. email。
3. password。
4. invite_code，可选，后续启用。
5. 注册成功后自动跳转登录或直接登录。

#### 7.6.4 Dashboard `/dashboard`

包含：

1. 当前用户信息。
2. 空间卡片列表。
3. 新建空间入口。
4. AI 聊天入口。
5. 博客入口。
6. root 用户显示超管入口。

#### 7.6.5 Chat 页面

要求：

1. 会话列表 `/chat`。
2. 会话详情 `/chat/[id]`。
3. 支持 SSE 流式接收。
4. 消息发送中按钮 disabled。
5. 支持 markdown 渲染 assistant 消息。
6. Qwen 模型支持图片上传；DeepSeek 模型禁用图片上传或提示不支持。

SSE 解析逻辑必须正确处理 buffer，不要假设每个 chunk 都是一条完整 JSON。

#### 7.6.6 Spaces 页面

空间主页 `/spaces/[id]` 包含：

1. 空间信息。
2. 成员列表。
3. 相册入口。
4. 笔记入口。
5. 位置标记入口，v1.0 可以只做手动编辑城市 / 标签。

#### 7.6.7 Albums 页面

包含：

1. 相册列表。
2. 创建相册。
3. 上传照片。
4. 瀑布流或网格展示。
5. 点击全屏预览。
6. 删除照片。

#### 7.6.8 Notes 页面

包含：

1. 笔记列表。
2. 创建笔记。
3. Markdown 编辑器。
4. 打开编辑器时请求 lock。
5. 编辑中每 5 分钟 heartbeat。
6. 离开页面释放 lock。
7. 被他人锁定时只读展示，并提示谁正在编辑。

#### 7.6.9 Blog 页面

包含：

1. 公开博客列表 `/blog`。
2. 文章详情 `/blog/[slug]`。
3. root 在 admin 中管理文章。

#### 7.6.10 Admin 页面

包含：

1. 用户管理。
2. 邀请码管理。
3. 系统配置。
4. LLM Key 配置。
5. lsky 配置。
6. 存储配额管理。
7. 非 root 访问跳转或显示 403。

### 7.7 manifest.json

```json
{
  "name": "Lumino",
  "short_name": "Lumino",
  "description": "你的私密生活空间",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#FAFAF8",
  "theme_color": "#E8814A",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### 7.8 前端验收命令

```bash
cd frontend
npm run lint
npm run build
npm run start
```

---

## 8. 部署步骤

### 8.1 服务器基础环境

```bash
sudo apt update
sudo apt install -y python3.11 python3.11-venv python3-pip git curl

curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

npm install -g pm2
```

Redis 可通过 1Panel Docker 安装，也可使用：

```bash
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

### 8.2 克隆与配置

```bash
cd /opt
git clone <你的仓库> lumino
cd /opt/lumino

cd backend
cp .env.example .env
# 编辑 .env，填入数据库、JWT_SECRET、root、lsky 等配置

python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

alembic upgrade head
python scripts/init_db.py

cd ../frontend
cp .env.local.example .env.local  # 如果存在
npm install
npm run build
```

### 8.3 ecosystem.config.js

在 `/opt/lumino/ecosystem.config.js` 创建：

```javascript
module.exports = {
  apps: [
    {
      name: 'lumino-frontend',
      cwd: '/opt/lumino/frontend',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'lumino-backend',
      cwd: '/opt/lumino/backend',
      interpreter: '/opt/lumino/backend/venv/bin/python',
      script: '/opt/lumino/backend/venv/bin/uvicorn',
      args: 'app.main:app --host 127.0.0.1 --port 8000 --workers 2',
      env: { PYTHONPATH: '/opt/lumino/backend' },
    },
  ],
}
```

启动：

```bash
cd /opt/lumino
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 8.4 OpenResty / Nginx 配置

```nginx
server {
    listen 80;
    server_name 114.55.55.110;

    client_max_body_size 20m;

    location /api/chat/sessions/ {
        proxy_pass         http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   Connection '';
        proxy_buffering    off;
        proxy_cache        off;
        chunked_transfer_encoding on;
        proxy_read_timeout 300s;
    }

    location /api/ {
        proxy_pass         http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

### 8.5 部署后检查

```bash
pm2 status
pm2 logs lumino-backend
pm2 logs lumino-frontend
curl http://127.0.0.1:8000/api/health
curl http://114.55.55.110/api/health
```

---

## 9. 阶段拆分与验收标准

## 阶段 1：数据库 + 后端骨架 + 认证

### 范围

实现：

1. FastAPI 项目骨架。
2. Settings 配置。
3. SQLAlchemy 连接。
4. 全部 ORM models。
5. Alembic 初始迁移。
6. Auth：register / login / refresh / logout / me。
7. Cookie JWT。
8. init_db.py 初始化 root。
9. GET `/api/health`。
10. 基础 pytest。

不实现：

1. 聊天。
2. lsky 上传。
3. 相册。
4. Markdown 编辑器。
5. 博客。
6. PWA。

### 验收

```bash
cd backend
source venv/bin/activate
alembic upgrade head
python scripts/init_db.py
uvicorn app.main:app --reload
pytest
ruff check .
black --check .
```

必须满足：

1. `/api/health` 返回 200。
2. root 可初始化。
3. 注册 / 登录 / me / refresh / logout 流程可用。
4. 重复运行 init_db.py 不重复创建 root。

---

## 阶段 2：前端骨架 + 登录注册 + Dashboard

### 范围

实现：

1. Next.js 14 项目初始化。
2. Tailwind 主题。
3. layout + ThemeProvider。
4. 首页。
5. 登录页。
6. 注册页。
7. Dashboard。
8. `lib/api.ts`。
9. `useAuth.ts`。

### 验收

```bash
cd frontend
npm run lint
npm run build
npm run start
```

必须满足：

1. 首页可访问。
2. 登录成功后进入 Dashboard。
3. 未登录访问 Dashboard 时跳转登录。
4. 401 自动尝试 refresh。
5. root 用户显示管理入口。

---

## 阶段 3：AI 聊天 + SSE + 多模态

### 范围

实现：

1. 后端 ChatSession / ChatMessage CRUD。
2. SSE 流式输出。
3. Qwen / DeepSeek 配置读取。
4. Qwen 图片消息。
5. DeepSeek 图片拦截。
6. 前端会话列表。
7. 前端聊天窗口。
8. 前端流式接收。

### 验收

1. 新建会话成功。
2. 发送文本消息能流式返回。
3. assistant 消息保存到数据库。
4. 刷新页面后历史消息仍在。
5. 选择 DeepSeek 上传图片时被拦截。
6. SSE 经 Nginx 反代后仍能逐字输出。

---

## 阶段 4：空间系统

### 范围

实现：

1. 空间创建。
2. 空间列表。
3. 空间详情。
4. 成员列表。
5. 添加 / 移除成员。
6. owner / member 权限。
7. Dashboard 空间入口。

### 验收

1. 创建空间后创建者自动成为 owner。
2. 非成员不能访问空间详情。
3. member 不能移除成员。
4. owner 可以修改空间信息。

---

## 阶段 5：相册模块

### 范围

实现：

1. 相册 CRUD。
2. 图片上传到 lsky-pro。
3. 照片记录保存数据库。
4. 存储配额统计。
5. 前端照片网格。
6. 全屏预览。

### 验收

1. 可创建相册。
2. 可上传图片。
3. 上传后图片能显示。
4. 超过配额时阻止上传。
5. 非空间成员不能访问相册。

---

## 阶段 6：Markdown 记录 + 编辑锁

### 范围

实现：

1. 笔记 CRUD。
2. Markdown 编辑器。
3. 获取锁。
4. 释放锁。
5. heartbeat。
6. 锁冲突提示。

### 验收

1. 用户 A 编辑时，用户 B 打开同一笔记提示只读。
2. 用户 A 离开后释放锁，用户 B 可编辑。
3. 锁超时后其他用户可抢锁。
4. 保存内容后刷新仍保留。

---

## 阶段 7：博客模块

### 范围

实现：

1. 公开博客列表。
2. 公开博客详情。
3. root 管理博客。
4. slug 唯一。
5. view_count。

### 验收

1. 访客可访问公开已发布文章。
2. 未发布文章访客不可见。
3. root 可创建 / 编辑 / 删除文章。

---

## 阶段 8：超管面板

### 范围

实现：

1. 用户管理。
2. 邀请码管理。
3. LLM 配置。
4. lsky 配置。
5. 存储配额。
6. 敏感配置加密存储和脱敏展示。

### 验收

1. 非 root 访问 admin 返回 403 或前端阻止。
2. root 可以修改默认模型。
3. API Key 展示时脱敏。
4. 禁用用户后该用户不能登录。

---

## 阶段 9：PWA + 暗色模式打磨

### 范围

实现：

1. manifest。
2. icon。
3. next-pwa 配置。
4. 全站暗色模式。
5. 移动端布局优化。

### 验收

1. Chrome Lighthouse PWA 基础项通过。
2. 亮 / 暗色切换正常。
3. 手机尺寸下页面可用。

---

## 阶段 10：部署 + 联调 + 压测

### 范围

实现：

1. 服务器部署。
2. PM2 守护。
3. Nginx / OpenResty 反代。
4. SSE 反代验证。
5. 上传大小限制。
6. 基础压测。
7. README 部署说明。

### 验收

1. `http://114.55.55.110/api/health` 返回 200。
2. 前端可访问。
3. 登录注册可用。
4. 聊天流式可用。
5. 图片上传可用。
6. PM2 重启后服务恢复。

---

## 10. Codex 阶段提示词模板

### 10.1 阶段 1 提示词

```text
请基于《Lumino 实施文档 v1.1》只实现阶段 1：数据库 + 后端骨架 + 认证。

严格要求：
1. 不要实现聊天、相册、笔记、博客、PWA。
2. 使用 Python 3.11、FastAPI、SQLAlchemy 2.x、Alembic、Pydantic v2。
3. 完整实现所有 ORM models。
4. 完整实现 Auth：register/login/refresh/logout/me。
5. 使用 HttpOnly Cookie 保存 access_token 和 refresh_token。
6. 生成 .env.example、requirements.txt、pyproject.toml、README 阶段 1 启动说明。
7. 实现 Alembic 初始迁移。
8. 实现 scripts/init_db.py，可重复执行且不会重复创建 root。
9. 添加 pytest：health 和 auth 基础流程。
10. 禁止 TODO、pass、伪代码。

完成后请运行：
- alembic upgrade head
- python scripts/init_db.py
- pytest
- ruff check .
- black --check .

最后输出：
1. 新增 / 修改文件列表；
2. 启动命令；
3. 测试结果；
4. 已完成项；
5. 未进入本阶段的功能。
```

### 10.2 阶段 2 提示词

```text
请在阶段 1 已完成的基础上，只实现阶段 2：前端骨架 + 登录注册 + Dashboard。

严格要求：
1. 使用 Next.js 14.2.x、React 18.3.x、Tailwind CSS 3.4.x。
2. 不要升级到 Next 15 或 Tailwind 4。
3. 实现首页、登录页、注册页、Dashboard。
4. 实现 lib/api.ts，支持 withCredentials 和 401 refresh。
5. 实现 useAuth.ts。
6. Dashboard 需要显示当前用户和 root 管理入口。
7. 未登录访问 Dashboard 时跳转 login。
8. 禁止 TODO、pass、伪代码、假接口。

完成后运行：
- npm run lint
- npm run build

最后输出新增 / 修改文件列表、启动命令、构建结果和已完成项。
```

### 10.3 阶段 3 提示词

```text
请在阶段 1、2 已完成的基础上，只实现阶段 3：AI 聊天 + SSE + 多模态。

严格要求：
1. 后端实现 ChatSession / ChatMessage CRUD。
2. 实现 POST /api/chat/sessions/{session_id}/messages，使用 SSE 流式返回。
3. 使用 openai Python SDK 的 chat.completions.create(stream=True)。
4. Qwen 支持图片 image_url，DeepSeek 只支持文本，遇到图片返回 400。
5. 前端实现会话列表、聊天详情、流式接收、消息历史展示。
6. SSE parser 必须处理 buffer，不要假设一个 chunk 就是一条完整 JSON。
7. 禁止 TODO、pass、伪代码。

完成后运行后端测试与前端 build，并输出结果。
```

后续阶段以同样格式推进。

---

## 11. README 最低要求

Codex 必须生成项目 README，包含：

1. 项目简介。
2. 技术栈。
3. 目录结构。
4. 后端本地启动。
5. 前端本地启动。
6. 数据库迁移。
7. root 初始化。
8. 生产部署。
9. 常见问题。

README 中必须包含：

```bash
cd backend
cp .env.example .env
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
python scripts/init_db.py
uvicorn app.main:app --reload
```

```bash
cd frontend
npm install
npm run dev
```

---

## 12. v2.0 备忘

以下功能不进入 v1.0，但可以保留设计位置：

1. 高德地图实时位置，情侣空间 PWA 获取 GPS 权限。
2. 通知系统，站内消息 + 邮件。
3. 相册视频支持。
4. 空间内 IM 聊天。
5. 图片压缩、EXIF 解析、按时间线展示。
6. lsky 文件删除同步。
7. 管理端操作日志。
8. 用户操作审计。
9. 多端登录管理。
10. 更细粒度角色权限。

---

## 13. 最终说明

这版文档已经从“人看的实施说明”调整为“Codex 可执行任务书”。

核心变化：

1. 保留数据库具体连接信息。
2. 固定 Next.js / React / Tailwind / Python 技术版本。
3. 增加 Alembic migration 要求。
4. 增加 SQL 外键与权限边界。
5. 增加完整 Auth 接口与 Cookie 策略。
6. 统一 LLM 流式实现方式。
7. 明确 DeepSeek 不处理图片、Qwen 处理多模态。
8. 增加阶段验收标准。
9. 增加 Codex 阶段提示词模板。
10. 明确禁止 TODO、伪代码、空实现。

建议执行顺序：先把阶段 1 跑通，再推进阶段 2 和阶段 3。不要让 Codex 一次性做完整 10 阶段。
