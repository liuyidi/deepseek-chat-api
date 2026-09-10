"""Lightweight audit log writes for the security center."""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import AuditLog


async def record_audit(
    db: AsyncSession,
    *,
    actor_user_id: uuid.UUID | None,
    action: str,
    target_type: str | None = None,
    target_id: str | None = None,
    ip: str | None = None,
    user_agent: str | None = None,
    device_label: str | None = None,
    client_id: str | None = None,
    location: str | None = None,
    commit: bool = False,
) -> None:
    db.add(
        AuditLog(
            actor_user_id=actor_user_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            ip=ip,
            user_agent=user_agent,
            device_label=device_label,
            client_id=client_id,
            location=location,
        )
    )
    if commit:
        await db.commit()
    else:
        await db.flush()
