import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import BIGINT_FK, BIGINT_PK, Base


class SpaceType(str, enum.Enum):
    COUPLE = "couple"
    FAMILY = "family"
    FRIENDS = "friends"
    PERSONAL = "personal"


class SpaceMemberRole(str, enum.Enum):
    OWNER = "owner"
    MEMBER = "member"


class Space(Base):
    __tablename__ = "spaces"

    id: Mapped[int] = mapped_column(BIGINT_PK, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    type: Mapped[SpaceType] = mapped_column(Enum(SpaceType), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    cover_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_by: Mapped[int] = mapped_column(
        BIGINT_FK, ForeignKey("users.id"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    creator = relationship("User", foreign_keys=[created_by])
    members = relationship("SpaceMember", back_populates="space", cascade="all, delete-orphan")
    invites = relationship("SpaceInvite", back_populates="space", cascade="all, delete-orphan")


class SpaceMember(Base):
    __tablename__ = "space_members"

    id: Mapped[int] = mapped_column(BIGINT_PK, primary_key=True, autoincrement=True)
    space_id: Mapped[int] = mapped_column(
        BIGINT_FK, ForeignKey("spaces.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        BIGINT_FK, ForeignKey("users.id"), nullable=False, index=True
    )
    role: Mapped[SpaceMemberRole] = mapped_column(
        Enum(SpaceMemberRole), default=SpaceMemberRole.MEMBER
    )
    joined_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    space = relationship("Space", back_populates="members")
    user = relationship("User", foreign_keys=[user_id])

    __table_args__ = (UniqueConstraint("space_id", "user_id", name="uq_space_user"),)


class SpaceInvite(Base):
    __tablename__ = "space_invites"

    id: Mapped[int] = mapped_column(BIGINT_PK, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    space_id: Mapped[int] = mapped_column(
        BIGINT_FK, ForeignKey("spaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_by: Mapped[int] = mapped_column(
        BIGINT_FK, ForeignKey("users.id"), nullable=False
    )
    max_uses: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    used_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    space = relationship("Space", back_populates="invites")
    creator = relationship("User", foreign_keys=[created_by])

