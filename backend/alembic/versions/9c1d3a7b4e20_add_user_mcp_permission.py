"""add user-level MCP permission

Revision ID: 9c1d3a7b4e20
Revises: c4e2a7d95b31
Create Date: 2026-08-05 11:30:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "9c1d3a7b4e20"
down_revision: Union[str, None] = "c4e2a7d95b31"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("can_use_mcp", sa.Boolean(), server_default=sa.false(), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("users", "can_use_mcp")
