"""expand auth core schema with sessions and token claims

Revision ID: 002
Revises: 001
Create Date: 2026-08-05
"""

from typing import Sequence, Union

import uuid
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "auth_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("client_id", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_auth_sessions_user_id_users", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_auth_sessions_user_id"), "auth_sessions", ["user_id"], unique=False)
    op.create_index(op.f("ix_auth_sessions_client_id"), "auth_sessions", ["client_id"], unique=False)

    op.create_table(
        "auth_clients",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("client_id", sa.String(length=100), nullable=False),
        sa.Column("client_secret_hash", sa.String(length=255), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("redirect_uris", sa.Text(), nullable=False),
        sa.Column("allowed_scopes", sa.Text(), server_default=sa.text("'openid profile email'"), nullable=False),
        sa.Column("pkce_required", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("status", sa.String(length=32), server_default=sa.text("'active'"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("client_id", name="uq_auth_clients_client_id"),
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("target_type", sa.String(length=100), nullable=True),
        sa.Column("target_id", sa.String(length=100), nullable=True),
        sa.Column("ip", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], name="fk_audit_logs_actor_user_id_users", ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_audit_logs_actor_user_id"), "audit_logs", ["actor_user_id"], unique=False)

    op.add_column("refresh_tokens", sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("refresh_tokens", sa.Column("jti", sa.String(length=36), nullable=True))
    op.add_column("refresh_tokens", sa.Column("rotated_from_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("refresh_tokens", sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True))

    op.create_foreign_key(
        "fk_refresh_tokens_session_id_auth_sessions",
        "refresh_tokens",
        "auth_sessions",
        ["session_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_refresh_tokens_rotated_from_id_refresh_tokens",
        "refresh_tokens",
        "refresh_tokens",
        ["rotated_from_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(op.f("ix_refresh_tokens_session_id"), "refresh_tokens", ["session_id"], unique=False)
    op.create_unique_constraint("uq_refresh_tokens_jti", "refresh_tokens", ["jti"])

    bind = op.get_bind()
    refresh_tokens = sa.table(
        "refresh_tokens",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("user_id", postgresql.UUID(as_uuid=True)),
        sa.column("expires_at", sa.DateTime(timezone=True)),
    )
    auth_sessions = sa.table(
        "auth_sessions",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("user_id", postgresql.UUID(as_uuid=True)),
        sa.column("client_id", sa.String(length=100)),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("expires_at", sa.DateTime(timezone=True)),
        sa.column("revoked_at", sa.DateTime(timezone=True)),
        sa.column("last_seen_at", sa.DateTime(timezone=True)),
    )

    existing_rows = bind.execute(
        sa.select(
            refresh_tokens.c.id,
            refresh_tokens.c.user_id,
            refresh_tokens.c.expires_at,
        )
    ).mappings().all()
    for row in existing_rows:
        generated_session_id = uuid.uuid4()

        bind.execute(
            sa.insert(auth_sessions).values(
                id=generated_session_id,
                user_id=row["user_id"],
                client_id=None,
                expires_at=row["expires_at"],
                revoked_at=None,
                last_seen_at=None,
            )
        )
        bind.execute(
            sa.update(refresh_tokens)
            .where(refresh_tokens.c.id == row["id"])
            .values(session_id=generated_session_id, jti=str(row["id"]))
        )

    op.alter_column("refresh_tokens", "session_id", nullable=False)
    op.alter_column("refresh_tokens", "jti", nullable=False)


def downgrade() -> None:
    op.drop_constraint("uq_refresh_tokens_jti", "refresh_tokens", type_="unique")
    op.drop_index(op.f("ix_refresh_tokens_session_id"), table_name="refresh_tokens")
    op.drop_constraint("fk_refresh_tokens_rotated_from_id_refresh_tokens", "refresh_tokens", type_="foreignkey")
    op.drop_constraint("fk_refresh_tokens_session_id_auth_sessions", "refresh_tokens", type_="foreignkey")
    op.drop_column("refresh_tokens", "revoked_at")
    op.drop_column("refresh_tokens", "rotated_from_id")
    op.drop_column("refresh_tokens", "jti")
    op.drop_column("refresh_tokens", "session_id")

    op.drop_index(op.f("ix_audit_logs_actor_user_id"), table_name="audit_logs")
    op.drop_table("audit_logs")

    op.drop_table("auth_clients")

    op.drop_index(op.f("ix_auth_sessions_client_id"), table_name="auth_sessions")
    op.drop_index(op.f("ix_auth_sessions_user_id"), table_name="auth_sessions")
    op.drop_table("auth_sessions")
