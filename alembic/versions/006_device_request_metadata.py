"""add device request metadata

Revision ID: 006
Revises: 005
Create Date: 2026-08-21
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "device_authorization_requests",
        sa.Column("device_label", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "device_authorization_requests",
        sa.Column("location", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "device_authorization_requests",
        sa.Column("ip_address", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "device_authorization_requests",
        sa.Column("user_agent", sa.String(length=500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("device_authorization_requests", "user_agent")
    op.drop_column("device_authorization_requests", "ip_address")
    op.drop_column("device_authorization_requests", "location")
    op.drop_column("device_authorization_requests", "device_label")
