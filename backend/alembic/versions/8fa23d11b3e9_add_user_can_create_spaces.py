"""add user can create spaces

Revision ID: 8fa23d11b3e9
Revises: ee7e073187c6
Create Date: 2026-06-05 00:48:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8fa23d11b3e9'
down_revision: Union[str, None] = 'ee7e073187c6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add column can_create_spaces with server default 'true' (mapped to True)
    op.add_column('users', sa.Column('can_create_spaces', sa.Boolean(), nullable=False, server_default=sa.text('true')))


def downgrade() -> None:
    op.drop_column('users', 'can_create_spaces')
