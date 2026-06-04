from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Numeric, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import BIGINT_PK, Base


class StorageQuota(Base):
    __tablename__ = "storage_quota"

    id: Mapped[int] = mapped_column(BIGINT_PK, primary_key=True, autoincrement=True)
    max_size_mb: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=1024.00, nullable=False)
    used_size_mb: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )
