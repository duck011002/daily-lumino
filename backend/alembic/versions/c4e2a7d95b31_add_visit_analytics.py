"""add privacy-conscious visit analytics

Revision ID: c4e2a7d95b31
Revises: 6b7d9e2f4a10
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "c4e2a7d95b31"
down_revision: str | None = "6b7d9e2f4a10"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bigint_pk = sa.BigInteger().with_variant(sa.Integer(), "sqlite")
    op.create_table(
        "visit_events",
        sa.Column("id", bigint_pk, autoincrement=True, nullable=False),
        sa.Column("visited_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("visit_date", sa.Date(), nullable=False),
        sa.Column("bucket_start", sa.DateTime(), nullable=False),
        sa.Column("ip_address", sa.String(length=45), nullable=False),
        sa.Column("ip_hash", sa.String(length=64), nullable=False),
        sa.Column("path", sa.String(length=320), nullable=False),
        sa.Column("country_code", sa.String(length=8), server_default="XX", nullable=False),
        sa.Column("subdivision_code", sa.String(length=32), server_default="XX", nullable=False),
        sa.Column("city_name", sa.String(length=100), server_default="XX", nullable=False),
        sa.Column("isp_code", sa.String(length=32), server_default="XX", nullable=False),
        sa.Column("device_type", sa.String(length=16), server_default="unknown", nullable=False),
        sa.Column("referrer_host", sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "visit_date", "bucket_start", "ip_hash", "path", name="uq_visit_event_dedupe"
        ),
    )
    op.create_index(op.f("ix_visit_events_visited_at"), "visit_events", ["visited_at"])
    op.create_index(op.f("ix_visit_events_visit_date"), "visit_events", ["visit_date"])
    op.create_index(op.f("ix_visit_events_ip_hash"), "visit_events", ["ip_hash"])
    op.create_index(op.f("ix_visit_events_path"), "visit_events", ["path"])
    op.create_index("idx_visit_event_date_path", "visit_events", ["visit_date", "path"])

    op.create_table(
        "visit_daily_summaries",
        sa.Column("summary_date", sa.Date(), nullable=False),
        sa.Column("page_views", sa.Integer(), server_default="0", nullable=False),
        sa.Column("unique_visitors", sa.Integer(), server_default="0", nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("summary_date"),
    )

    op.create_table(
        "visit_daily_dimensions",
        sa.Column("id", bigint_pk, autoincrement=True, nullable=False),
        sa.Column("summary_date", sa.Date(), nullable=False),
        sa.Column("dimension_type", sa.String(length=24), nullable=False),
        sa.Column("dimension_value", sa.String(length=320), nullable=False),
        sa.Column("page_views", sa.Integer(), server_default="0", nullable=False),
        sa.Column("unique_visitors", sa.Integer(), server_default="0", nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "summary_date", "dimension_type", "dimension_value", name="uq_visit_daily_dimension"
        ),
    )
    op.create_index(
        op.f("ix_visit_daily_dimensions_summary_date"),
        "visit_daily_dimensions",
        ["summary_date"],
    )
    op.create_index(
        "idx_visit_dimension_lookup",
        "visit_daily_dimensions",
        ["dimension_type", "summary_date"],
    )


def downgrade() -> None:
    op.drop_index("idx_visit_dimension_lookup", table_name="visit_daily_dimensions")
    op.drop_index(
        op.f("ix_visit_daily_dimensions_summary_date"),
        table_name="visit_daily_dimensions",
    )
    op.drop_table("visit_daily_dimensions")
    op.drop_table("visit_daily_summaries")
    op.drop_index("idx_visit_event_date_path", table_name="visit_events")
    op.drop_index(op.f("ix_visit_events_path"), table_name="visit_events")
    op.drop_index(op.f("ix_visit_events_ip_hash"), table_name="visit_events")
    op.drop_index(op.f("ix_visit_events_visit_date"), table_name="visit_events")
    op.drop_index(op.f("ix_visit_events_visited_at"), table_name="visit_events")
    op.drop_table("visit_events")
