"""audit log device metadata

Revision ID: 008
Revises: 007
Create Date: 2026-09-10
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("audit_logs", sa.Column("device_label", sa.String(255), nullable=True))
    op.add_column("audit_logs", sa.Column("client_id", sa.String(100), nullable=True))
    op.add_column("audit_logs", sa.Column("location", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("audit_logs", "location")
    op.drop_column("audit_logs", "client_id")
    op.drop_column("audit_logs", "device_label")
