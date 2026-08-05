"""add AI multimodal ingest jobs

Revision ID: a7e4c2d1f890
Revises: 9c1d3a7b4e20
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import mysql

from alembic import op

revision: str = "a7e4c2d1f890"
down_revision: str | None = "9c1d3a7b4e20"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bigint_pk = sa.BigInteger().with_variant(sa.Integer(), "sqlite")
    op.create_table(
        "ai_ingest_jobs",
        sa.Column("id", bigint_pk, autoincrement=True, nullable=False),
        sa.Column("user_id", bigint_pk, nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("media_type", sa.String(length=120), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=24), server_default="queued", nullable=False),
        sa.Column(
            "extracted_text",
            sa.Text().with_variant(mysql.LONGTEXT(), "mysql"),
            nullable=True,
        ),
        sa.Column("error_message", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_ai_ingest_jobs_user_id"), "ai_ingest_jobs", ["user_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_ai_ingest_jobs_user_id"), table_name="ai_ingest_jobs")
    op.drop_table("ai_ingest_jobs")
