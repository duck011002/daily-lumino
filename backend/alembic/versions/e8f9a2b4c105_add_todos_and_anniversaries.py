"""add todos and space anniversaries tables

Revision ID: e8f9a2b4c105
Revises: a7e4c2d1f890
"""

from collections.abc import Sequence
import sqlalchemy as sa
from alembic import op

revision: str = "e8f9a2b4c105"
down_revision: str | None = "a7e4c2d1f890"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bigint_pk = sa.BigInteger().with_variant(sa.Integer(), "sqlite")

    # 1. 创建 todos 表
    op.create_table(
        "todos",
        sa.Column("id", bigint_pk, autoincrement=True, nullable=False),
        sa.Column("user_id", bigint_pk, nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("priority", sa.String(length=20), server_default="medium", nullable=False),
        sa.Column("status", sa.String(length=20), server_default="pending", nullable=False),
        sa.Column("due_at", sa.DateTime(), nullable=True),
        sa.Column("remind_at", sa.DateTime(), nullable=True),
        sa.Column("is_reminded", sa.Boolean(), server_default="0", nullable=False),
        sa.Column("source_url", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_todos_id"), "todos", ["id"])
    op.create_index(op.f("ix_todos_user_id"), "todos", ["user_id"])

    # 2. 创建 space_anniversaries 表
    op.create_table(
        "space_anniversaries",
        sa.Column("id", bigint_pk, autoincrement=True, nullable=False),
        sa.Column("space_id", bigint_pk, nullable=False),
        sa.Column("title", sa.String(length=100), nullable=False),
        sa.Column("target_date", sa.DateTime(), nullable=False),
        sa.Column("icon", sa.String(length=50), server_default="❤️", nullable=True),
        sa.Column("color", sa.String(length=50), server_default="amber", nullable=True),
        sa.Column("is_pinned", sa.Boolean(), server_default="0", nullable=False),
        sa.Column("created_by", bigint_pk, nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["space_id"], ["spaces.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_space_anniversaries_space_id"), "space_anniversaries", ["space_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_space_anniversaries_space_id"), table_name="space_anniversaries")
    op.drop_table("space_anniversaries")
    op.drop_index(op.f("ix_todos_user_id"), table_name="todos")
    op.drop_index(op.f("ix_todos_id"), table_name="todos")
    op.drop_table("todos")
