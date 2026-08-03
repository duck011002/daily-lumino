"""add admin-managed MCP blog tokens

Revision ID: f2c8a4d15e72
Revises: d91b7b43ce11
Create Date: 2026-07-27 18:10:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "f2c8a4d15e72"
down_revision: Union[str, None] = "d91b7b43ce11"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "mcp_blog_tokens",
        sa.Column("id", sa.BigInteger().with_variant(sa.Integer(), "sqlite"), autoincrement=True, nullable=False),
        sa.Column("label", sa.String(length=100), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("author_id", sa.BigInteger().with_variant(sa.Integer(), "sqlite"), nullable=False),
        sa.Column("created_by", sa.BigInteger().with_variant(sa.Integer(), "sqlite"), nullable=False),
        sa.Column("allow_auto_publish", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("last_used_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index(op.f("ix_mcp_blog_tokens_author_id"), "mcp_blog_tokens", ["author_id"], unique=False)
    op.create_index(op.f("ix_mcp_blog_tokens_created_by"), "mcp_blog_tokens", ["created_by"], unique=False)
    op.create_index(op.f("ix_mcp_blog_tokens_is_active"), "mcp_blog_tokens", ["is_active"], unique=False)
    op.create_index(op.f("ix_mcp_blog_tokens_token_hash"), "mcp_blog_tokens", ["token_hash"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_mcp_blog_tokens_token_hash"), table_name="mcp_blog_tokens")
    op.drop_index(op.f("ix_mcp_blog_tokens_is_active"), table_name="mcp_blog_tokens")
    op.drop_index(op.f("ix_mcp_blog_tokens_created_by"), table_name="mcp_blog_tokens")
    op.drop_index(op.f("ix_mcp_blog_tokens_author_id"), table_name="mcp_blog_tokens")
    op.drop_table("mcp_blog_tokens")
