"""add blog soft delete

Revision ID: e3b7c1d9a204
Revises: c8d7f1a2b304
Create Date: 2026-09-01
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "e3b7c1d9a204"
down_revision: str | None = "c8d7f1a2b304"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("blog_posts", sa.Column("deleted_at", sa.DateTime(), nullable=True))
    op.create_index("ix_blog_posts_deleted_at", "blog_posts", ["deleted_at"], unique=False)
    op.create_index(
        "idx_blog_active_published",
        "blog_posts",
        ["deleted_at", "is_public", "is_published"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_blog_active_published", table_name="blog_posts")
    op.drop_index("ix_blog_posts_deleted_at", table_name="blog_posts")
    op.drop_column("blog_posts", "deleted_at")
