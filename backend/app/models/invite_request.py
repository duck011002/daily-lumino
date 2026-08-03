from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import BIGINT_FK, BIGINT_PK, Base


class InviteRequest(Base):
    __tablename__ = "invite_requests"

    id: Mapped[int] = mapped_column(BIGINT_PK, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    verify_token_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    verify_token_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    admin_action_token_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    admin_action_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    admin_notified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    rejected_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    invite_code_id: Mapped[int | None] = mapped_column(
        BIGINT_FK, ForeignKey("invite_codes.id"), nullable=True, index=True
    )
    request_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    invite_code = relationship("InviteCode", foreign_keys=[invite_code_id])
