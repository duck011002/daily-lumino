from datetime import date, datetime

from sqlalchemy import Date, DateTime, Index, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import BIGINT_PK, Base


class VisitEvent(Base):
    __tablename__ = "visit_events"

    id: Mapped[int] = mapped_column(BIGINT_PK, primary_key=True, autoincrement=True)
    visited_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False, index=True
    )
    visit_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    bucket_start: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    ip_address: Mapped[str] = mapped_column(String(45), nullable=False)
    ip_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    path: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    country_code: Mapped[str] = mapped_column(String(8), default="XX", nullable=False)
    subdivision_code: Mapped[str] = mapped_column(String(32), default="XX", nullable=False)
    city_name: Mapped[str] = mapped_column(String(100), default="XX", nullable=False)
    isp_code: Mapped[str] = mapped_column(String(32), default="XX", nullable=False)
    device_type: Mapped[str] = mapped_column(String(16), default="unknown", nullable=False)
    referrer_host: Mapped[str | None] = mapped_column(String(255), nullable=True)

    __table_args__ = (
        UniqueConstraint(
            "visit_date",
            "bucket_start",
            "ip_hash",
            "path",
            name="uq_visit_event_dedupe",
        ),
        Index("idx_visit_event_date_path", "visit_date", "path"),
    )


class VisitDailySummary(Base):
    __tablename__ = "visit_daily_summaries"

    summary_date: Mapped[date] = mapped_column(Date, primary_key=True)
    page_views: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    unique_visitors: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )


class VisitDailyDimension(Base):
    __tablename__ = "visit_daily_dimensions"

    id: Mapped[int] = mapped_column(BIGINT_PK, primary_key=True, autoincrement=True)
    summary_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    dimension_type: Mapped[str] = mapped_column(String(24), nullable=False)
    dimension_value: Mapped[str] = mapped_column(String(320), nullable=False)
    page_views: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    unique_visitors: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    __table_args__ = (
        UniqueConstraint(
            "summary_date",
            "dimension_type",
            "dimension_value",
            name="uq_visit_daily_dimension",
        ),
        Index(
            "idx_visit_dimension_lookup",
            "dimension_type",
            "summary_date",
        ),
    )
