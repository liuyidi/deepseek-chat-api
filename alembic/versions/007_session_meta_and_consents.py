"""session metadata and oauth consents

Revision ID: 007
Revises: 006
Create Date: 2026-08-21
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("auth_sessions", sa.Column("user_agent", sa.String(length=500), nullable=True))
    op.add_column("auth_sessions", sa.Column("ip_address", sa.String(length=64), nullable=True))
    op.add_column("auth_sessions", sa.Column("device_label", sa.String(length=255), nullable=True))
    op.add_column("auth_sessions", sa.Column("location", sa.String(length=255), nullable=True))

    op.create_table(
        "oauth_consents",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("client_id", sa.String(length=100), nullable=False),
        sa.Column("scopes", sa.Text(), nullable=False, server_default="openid profile email"),
        sa.Column("authorized_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "client_id", name="uq_oauth_consents_user_client"),
    )
    op.create_index(op.f("ix_oauth_consents_user_id"), "oauth_consents", ["user_id"], unique=False)
    op.create_index(op.f("ix_oauth_consents_client_id"), "oauth_consents", ["client_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_oauth_consents_client_id"), table_name="oauth_consents")
    op.drop_index(op.f("ix_oauth_consents_user_id"), table_name="oauth_consents")
    op.drop_table("oauth_consents")
    op.drop_column("auth_sessions", "location")
    op.drop_column("auth_sessions", "device_label")
    op.drop_column("auth_sessions", "ip_address")
    op.drop_column("auth_sessions", "user_agent")
