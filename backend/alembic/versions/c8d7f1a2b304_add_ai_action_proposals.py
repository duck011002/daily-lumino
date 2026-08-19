"""add AI action proposals

Revision ID: c8d7f1a2b304
Revises: b4a1f6c8d209
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c8d7f1a2b304"
down_revision: str | None = "b4a1f6c8d209"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bigint = sa.BigInteger().with_variant(sa.Integer(), "sqlite")
    op.create_table(
        "ai_action_proposals",
        sa.Column("id", bigint, autoincrement=True, nullable=False),
        sa.Column("user_id", bigint, nullable=False),
        sa.Column("session_id", bigint, nullable=True),
        sa.Column("tool", sa.String(length=100), nullable=False),
        sa.Column("arguments_json", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
        sa.Column("action_run_id", bigint, nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["action_run_id"], ["ai_action_runs.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["session_id"], ["chat_sessions.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("user_id", "session_id", "status", "expires_at"):
        op.create_index(
            f"ix_ai_action_proposals_{column}", "ai_action_proposals", [column]
        )


def downgrade() -> None:
    op.drop_table("ai_action_proposals")

