"""add ledger, AI actions, and unified MCP credentials

Revision ID: b4a1f6c8d209
Revises: e8f9a2b4c105
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b4a1f6c8d209"
down_revision: str | None = "e8f9a2b4c105"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bigint = sa.BigInteger().with_variant(sa.Integer(), "sqlite")

    op.create_table(
        "ledger_categories",
        sa.Column("id", bigint, autoincrement=True, nullable=False),
        sa.Column("user_id", bigint, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("normalized_name", sa.String(length=100), nullable=False),
        sa.Column("entry_type", sa.String(length=20), nullable=False),
        sa.Column("is_default", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("is_archived", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id", "entry_type", "normalized_name", name="uq_ledger_category_user_type_name"
        ),
    )
    op.create_index("ix_ledger_categories_user_id", "ledger_categories", ["user_id"])
    op.create_index("ix_ledger_categories_entry_type", "ledger_categories", ["entry_type"])
    op.create_index("ix_ledger_categories_is_archived", "ledger_categories", ["is_archived"])

    op.create_table(
        "ledger_entries",
        sa.Column("id", bigint, autoincrement=True, nullable=False),
        sa.Column("user_id", bigint, nullable=False),
        sa.Column("category_id", bigint, nullable=False),
        sa.Column("entry_type", sa.String(length=20), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("currency", sa.String(length=3), server_default="CNY", nullable=False),
        sa.Column("occurred_at", sa.DateTime(), nullable=False),
        sa.Column("note", sa.String(length=500), nullable=True),
        sa.Column("source", sa.String(length=20), nullable=False),
        sa.Column("idempotency_key", sa.String(length=100), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["category_id"], ["ledger_categories.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "idempotency_key", name="uq_ledger_entry_user_idempotency"),
    )
    for column in ("user_id", "category_id", "entry_type", "occurred_at", "deleted_at"):
        op.create_index(f"ix_ledger_entries_{column}", "ledger_entries", [column])

    op.create_table(
        "ai_action_runs",
        sa.Column("id", bigint, autoincrement=True, nullable=False),
        sa.Column("user_id", bigint, nullable=False),
        sa.Column("source", sa.String(length=20), nullable=False),
        sa.Column("tool_name", sa.String(length=100), nullable=False),
        sa.Column("idempotency_key", sa.String(length=100), nullable=False),
        sa.Column("request_json", sa.JSON(), nullable=False),
        sa.Column("result_json", sa.JSON(), nullable=True),
        sa.Column("before_json", sa.JSON(), nullable=True),
        sa.Column("target_type", sa.String(length=50), nullable=True),
        sa.Column("target_id", bigint, nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("error_code", sa.String(length=100), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("undone_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "idempotency_key", name="uq_ai_action_user_idempotency"),
    )
    for column in ("user_id", "source", "tool_name", "status"):
        op.create_index(f"ix_ai_action_runs_{column}", "ai_action_runs", [column])

    op.create_table(
        "mcp_lumino_tokens",
        sa.Column("id", bigint, autoincrement=True, nullable=False),
        sa.Column("label", sa.String(length=100), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("user_id", bigint, nullable=False),
        sa.Column("created_by", bigint, nullable=False),
        sa.Column("scopes", sa.JSON(), nullable=False),
        sa.Column("allow_auto_publish", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("last_used_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_mcp_lumino_tokens_token_hash", "mcp_lumino_tokens", ["token_hash"], unique=True)
    op.create_index("ix_mcp_lumino_tokens_user_id", "mcp_lumino_tokens", ["user_id"])
    op.create_index("ix_mcp_lumino_tokens_created_by", "mcp_lumino_tokens", ["created_by"])
    op.create_index("ix_mcp_lumino_tokens_is_active", "mcp_lumino_tokens", ["is_active"])


def downgrade() -> None:
    op.drop_table("mcp_lumino_tokens")
    op.drop_table("ai_action_runs")
    op.drop_table("ledger_entries")
    op.drop_table("ledger_categories")
