from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import BIGINT_FK, BIGINT_PK, Base


class Note(Base):
    __tablename__ = "notes"

    id: Mapped[int] = mapped_column(BIGINT_PK, primary_key=True, autoincrement=True)
    space_id: Mapped[int] = mapped_column(
        BIGINT_FK, ForeignKey("spaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    content: Mapped[str | None] = mapped_column(
        Text().with_variant(LONGTEXT, "mysql"), nullable=True
    )
    cover_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    author_id: Mapped[int] = mapped_column(
        BIGINT_FK, ForeignKey("users.id"), nullable=False, index=True
    )
    lock_by: Mapped[int | None] = mapped_column(
        BIGINT_FK, ForeignKey("users.id"), nullable=True, index=True
    )
    lock_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    space = relationship("Space")
    author = relationship("User", foreign_keys=[author_id])
    locked_user = relationship("User", foreign_keys=[lock_by])
