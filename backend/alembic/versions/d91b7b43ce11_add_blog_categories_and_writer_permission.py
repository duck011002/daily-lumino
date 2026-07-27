"""add blog categories and writer permission

Revision ID: d91b7b43ce11
Revises: 0b2f7ef29c7c
Create Date: 2026-07-27 15:30:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "d91b7b43ce11"
down_revision: Union[str, None] = "0b2f7ef29c7c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("can_write_blog", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    op.create_table(
        "blog_categories",
        sa.Column(
            "id",
            sa.BigInteger().with_variant(sa.Integer(), "sqlite"),
            autoincrement=True,
            nullable=False,
        ),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("slug", sa.String(length=100), nullable=False),
        sa.Column("description", sa.String(length=300), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
        sa.UniqueConstraint("slug"),
    )

    op.add_column(
        "blog_posts",
        sa.Column(
            "category_id",
            sa.BigInteger().with_variant(sa.Integer(), "sqlite"),
            nullable=True,
        ),
    )
    op.create_foreign_key(
        "fk_blog_posts_category_id_blog_categories",
        "blog_posts",
        "blog_categories",
        ["category_id"],
        ["id"],
    )
    op.create_index(op.f("ix_blog_posts_category_id"), "blog_posts", ["category_id"], unique=False)
    op.create_index(
        "idx_blog_category_published",
        "blog_posts",
        ["category_id", "is_public", "is_published"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_blog_category_published", table_name="blog_posts")
    op.drop_index(op.f("ix_blog_posts_category_id"), table_name="blog_posts")
    op.drop_constraint("fk_blog_posts_category_id_blog_categories", "blog_posts", type_="foreignkey")
    op.drop_column("blog_posts", "category_id")
    op.drop_table("blog_categories")
    op.drop_column("users", "can_write_blog")
