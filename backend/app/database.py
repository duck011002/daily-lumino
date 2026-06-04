from collections.abc import Generator

from sqlalchemy import BigInteger, Integer, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

# Database-agnostic types to support SQLite in-memory testing while keeping MySQL BIGINT
BIGINT_PK = BigInteger().with_variant(Integer, "sqlite")
BIGINT_FK = BigInteger().with_variant(Integer, "sqlite")

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
