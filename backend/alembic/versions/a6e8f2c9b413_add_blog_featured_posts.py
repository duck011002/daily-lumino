"""add featured blog posts

Revision ID: a6e8f2c9b413
Revises: f2c8a4d15e72
Create Date: 2026-07-28 10:30:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "a6e8f2c9b413"
down_revision: Union[str, None] = "f2c8a4d15e72"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "blog_posts",
        sa.Column("is_featured", sa.Boolean(), server_default=sa.false(), nullable=False),
    )
    op.create_index("ix_blog_posts_is_featured", "blog_posts", ["is_featured"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_blog_posts_is_featured", table_name="blog_posts")
    op.drop_column("blog_posts", "is_featured")
