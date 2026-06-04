from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import BIGINT_FK, BIGINT_PK, Base


class LocationPin(Base):
    __tablename__ = "location_pins"

    id: Mapped[int] = mapped_column(BIGINT_PK, primary_key=True, autoincrement=True)
    space_id: Mapped[int] = mapped_column(
        BIGINT_FK, ForeignKey("spaces.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        BIGINT_FK, ForeignKey("users.id"), nullable=False, index=True
    )
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    label: Mapped[str | None] = mapped_column(String(100), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    space = relationship("Space")
    user = relationship("User", foreign_keys=[user_id])

    __table_args__ = (UniqueConstraint("space_id", "user_id", name="uq_location_space_user"),)
