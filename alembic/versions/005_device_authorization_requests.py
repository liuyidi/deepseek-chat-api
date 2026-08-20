"""add device authorization requests

Revision ID: 005
Revises: 004
Create Date: 2026-08-20
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "device_authorization_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("device_code", sa.String(length=255), nullable=False),
        sa.Column("user_code", sa.String(length=32), nullable=False),
        sa.Column("client_id", sa.String(length=100), nullable=False),
        sa.Column("scope", sa.Text(), server_default=sa.text("'openid profile email'"), nullable=False),
        sa.Column("verification_uri", sa.String(length=500), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("interval", sa.Integer(), server_default=sa.text("5"), nullable=False),
        sa.Column("status", sa.String(length=32), server_default=sa.text("'pending'"), nullable=False),
        sa.Column("approved_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("denied_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["approved_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("device_code"),
        sa.UniqueConstraint("user_code"),
    )
    op.create_index(op.f("ix_device_authorization_requests_device_code"), "device_authorization_requests", ["device_code"], unique=False)
    op.create_index(op.f("ix_device_authorization_requests_user_code"), "device_authorization_requests", ["user_code"], unique=False)
    op.create_index(op.f("ix_device_authorization_requests_client_id"), "device_authorization_requests", ["client_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_device_authorization_requests_client_id"), table_name="device_authorization_requests")
    op.drop_index(op.f("ix_device_authorization_requests_user_code"), table_name="device_authorization_requests")
    op.drop_index(op.f("ix_device_authorization_requests_device_code"), table_name="device_authorization_requests")
    op.drop_table("device_authorization_requests")
