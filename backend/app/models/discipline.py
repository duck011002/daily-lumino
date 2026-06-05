from datetime import date, datetime
from sqlalchemy import Boolean, DateTime, Date, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import BIGINT_PK, BIGINT_FK, Base


class UserHealthProfile(Base):
    __tablename__ = "user_health_profiles"

    user_id: Mapped[int] = mapped_column(
        BIGINT_FK, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    height: Mapped[float] = mapped_column(Float, nullable=False)
    initial_weight: Mapped[float] = mapped_column(Float, nullable=False)
    target_weight: Mapped[float | None] = mapped_column(Float, nullable=True)
    bmi: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user = relationship("User")


class DailyDisciplineLog(Base):
    __tablename__ = "daily_discipline_logs"

    id: Mapped[int] = mapped_column(BIGINT_PK, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        BIGINT_FK, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    log_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    weight: Mapped[float | None] = mapped_column(Float, nullable=True)
    step_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    active_energy: Mapped[float | None] = mapped_column(Float, nullable=True)
    diet_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    diet_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    fitness_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    fitness_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    intake_calories: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    burned_calories: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    calorie_gap: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    ai_analysis: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("user_id", "log_date", name="uq_user_discipline_date"),
    )

    user = relationship("User")
