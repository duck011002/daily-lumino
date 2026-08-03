"""add MCP library tokens

Revision ID: 6b7d9e2f4a10
Revises: a6e8f2c9b413
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "6b7d9e2f4a10"
down_revision: Union[str, None] = "a6e8f2c9b413"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "mcp_library_tokens",
        sa.Column("id", sa.BigInteger().with_variant(sa.Integer(), "sqlite"), autoincrement=True, nullable=False),
        sa.Column("label", sa.String(length=100), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("created_by", sa.BigInteger().with_variant(sa.Integer(), "sqlite"), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("last_used_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index(op.f("ix_mcp_library_tokens_created_by"), "mcp_library_tokens", ["created_by"])
    op.create_index(op.f("ix_mcp_library_tokens_is_active"), "mcp_library_tokens", ["is_active"])
    op.create_index(op.f("ix_mcp_library_tokens_token_hash"), "mcp_library_tokens", ["token_hash"])


def downgrade() -> None:
    op.drop_index(op.f("ix_mcp_library_tokens_token_hash"), table_name="mcp_library_tokens")
    op.drop_index(op.f("ix_mcp_library_tokens_is_active"), table_name="mcp_library_tokens")
    op.drop_index(op.f("ix_mcp_library_tokens_created_by"), table_name="mcp_library_tokens")
    op.drop_table("mcp_library_tokens")
