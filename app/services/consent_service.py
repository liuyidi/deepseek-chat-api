"""Persistent OAuth consent (authorization) records."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import AuthClient, AuthSession, OAuthConsent, RefreshToken
from app.services.audit_service import record_audit
from app.services.request_context import SessionMeta


def _utcnow() -> datetime:
    return datetime.now(UTC)


class ConsentError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400) -> None:
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


async def upsert_oauth_consent(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    client_id: str,
    scopes: str,
    commit: bool = False,
) -> OAuthConsent:
    normalized_client = client_id.strip()
    if not normalized_client:
        raise ConsentError("invalid_client", "client_id is required", status_code=400)

    now = _utcnow()
    result = await db.execute(
        select(OAuthConsent).where(
            OAuthConsent.user_id == user_id,
            OAuthConsent.client_id == normalized_client,
        )
    )
    consent = result.scalar_one_or_none()
    if consent is None:
        consent = OAuthConsent(
            user_id=user_id,
            client_id=normalized_client,
            scopes=scopes or "openid profile email",
            authorized_at=now,
            last_used_at=now,
            revoked_at=None,
        )
        db.add(consent)
    else:
        consent.scopes = scopes or consent.scopes
        consent.last_used_at = now
        if consent.revoked_at is not None:
            consent.revoked_at = None
            consent.authorized_at = now
        consent.updated_at = now

    if commit:
        await db.commit()
        await db.refresh(consent)
    else:
        await db.flush()
    return consent


async def list_active_consents(db: AsyncSession, user_id: uuid.UUID) -> list[OAuthConsent]:
    result = await db.execute(
        select(OAuthConsent)
        .where(OAuthConsent.user_id == user_id, OAuthConsent.revoked_at.is_(None))
        .order_by(OAuthConsent.authorized_at.desc())
    )
    return list(result.scalars().all())


async def revoke_oauth_consent(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    client_id: str,
    meta: SessionMeta | None = None,
) -> None:
    normalized_client = client_id.strip()
    result = await db.execute(
        select(OAuthConsent).where(
            OAuthConsent.user_id == user_id,
            OAuthConsent.client_id == normalized_client,
            OAuthConsent.revoked_at.is_(None),
        )
    )
    consent = result.scalar_one_or_none()
    if consent is None:
        raise ConsentError("not_found", "Consent not found", status_code=404)

    now = _utcnow()
    consent.revoked_at = now
    consent.updated_at = now

    sessions_result = await db.execute(
        select(AuthSession).where(
            AuthSession.user_id == user_id,
            AuthSession.client_id == normalized_client,
            AuthSession.revoked_at.is_(None),
        )
    )
    sessions = list(sessions_result.scalars().all())
    session_ids = [session.id for session in sessions]
    for session in sessions:
        session.revoked_at = now
        session.last_seen_at = now

    if session_ids:
        await db.execute(
            update(RefreshToken)
            .where(
                RefreshToken.session_id.in_(session_ids),
                RefreshToken.revoked_at.is_(None),
            )
            .values(revoked_at=now)
        )

    await record_audit(
        db,
        actor_user_id=user_id,
        action="consent.revoke",
        target_type="client",
        target_id=normalized_client,
        ip=meta.ip_address if meta else None,
        user_agent=meta.user_agent if meta else None,
    )
    await db.commit()


async def resolve_client_name(db: AsyncSession, client_id: str) -> str:
    result = await db.execute(select(AuthClient).where(AuthClient.client_id == client_id))
    client = result.scalar_one_or_none()
    if client is not None:
        return client.name
    return client_id
