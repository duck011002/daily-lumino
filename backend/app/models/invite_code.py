from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import BIGINT_FK, BIGINT_PK, Base


class InviteCode(Base):
    __tablename__ = "invite_codes"

    id: Mapped[int] = mapped_column(BIGINT_PK, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    created_by: Mapped[int] = mapped_column(
        BIGINT_FK, ForeignKey("users.id"), nullable=False, index=True
    )
    used_by: Mapped[int | None] = mapped_column(
        BIGINT_FK, ForeignKey("users.id"), nullable=True, index=True
    )
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    creator = relationship("User", foreign_keys=[created_by])
    user = relationship("User", foreign_keys=[used_by])
