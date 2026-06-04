from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import BIGINT_FK, BIGINT_PK, Base


class Album(Base):
    __tablename__ = "albums"

    id: Mapped[int] = mapped_column(BIGINT_PK, primary_key=True, autoincrement=True)
    space_id: Mapped[int] = mapped_column(
        BIGINT_FK, ForeignKey("spaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    cover_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_by: Mapped[int] = mapped_column(
        BIGINT_FK, ForeignKey("users.id"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    space = relationship("Space")
    creator = relationship("User", foreign_keys=[created_by])
    photos = relationship("Photo", back_populates="album", cascade="all, delete-orphan")


class Photo(Base):
    __tablename__ = "photos"

    id: Mapped[int] = mapped_column(BIGINT_PK, primary_key=True, autoincrement=True)
    album_id: Mapped[int] = mapped_column(
        BIGINT_FK, ForeignKey("albums.id", ondelete="CASCADE"), nullable=False, index=True
    )
    space_id: Mapped[int] = mapped_column(
        BIGINT_FK, ForeignKey("spaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    uploader_id: Mapped[int] = mapped_column(
        BIGINT_FK, ForeignKey("users.id"), nullable=False, index=True
    )
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    thumb_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    caption: Mapped[str | None] = mapped_column(Text, nullable=True)
    taken_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    file_size_kb: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    album = relationship("Album", back_populates="photos")
    space = relationship("Space")
    uploader = relationship("User", foreign_keys=[uploader_id])
