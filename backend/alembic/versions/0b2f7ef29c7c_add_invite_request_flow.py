"""add invite request flow

Revision ID: 0b2f7ef29c7c
Revises: 8fa23d11b3e9
Create Date: 2026-06-05 17:55:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "0b2f7ef29c7c"
down_revision: Union[str, None] = "8fa23d11b3e9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("invite_codes", sa.Column("target_email", sa.String(length=100), nullable=True))
    op.create_index(
        op.f("ix_invite_codes_target_email"), "invite_codes", ["target_email"], unique=False
    )

    op.create_table(
        "invite_requests",
        sa.Column(
            "id",
            sa.BigInteger().with_variant(sa.Integer(), "sqlite"),
            autoincrement=True,
            nullable=False,
        ),
        sa.Column("email", sa.String(length=100), nullable=False),
        sa.Column("display_name", sa.String(length=100), nullable=True),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("verify_token_hash", sa.String(length=128), nullable=True),
        sa.Column("verify_token_expires_at", sa.DateTime(), nullable=True),
        sa.Column("verified_at", sa.DateTime(), nullable=True),
        sa.Column("admin_action_token_hash", sa.String(length=128), nullable=True),
        sa.Column("admin_action_expires_at", sa.DateTime(), nullable=True),
        sa.Column("admin_notified_at", sa.DateTime(), nullable=True),
        sa.Column("approved_at", sa.DateTime(), nullable=True),
        sa.Column("rejected_at", sa.DateTime(), nullable=True),
        sa.Column(
            "invite_code_id",
            sa.BigInteger().with_variant(sa.Integer(), "sqlite"),
            nullable=True,
        ),
        sa.Column("request_ip", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["invite_code_id"], ["invite_codes.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_invite_requests_email"), "invite_requests", ["email"], unique=False)
    op.create_index(
        op.f("ix_invite_requests_invite_code_id"),
        "invite_requests",
        ["invite_code_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_invite_requests_status"), "invite_requests", ["status"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_invite_requests_status"), table_name="invite_requests")
    op.drop_index(op.f("ix_invite_requests_invite_code_id"), table_name="invite_requests")
    op.drop_index(op.f("ix_invite_requests_email"), table_name="invite_requests")
    op.drop_table("invite_requests")
    op.drop_index(op.f("ix_invite_codes_target_email"), table_name="invite_codes")
    op.drop_column("invite_codes", "target_email")
