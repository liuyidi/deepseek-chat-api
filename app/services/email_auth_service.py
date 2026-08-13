from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user import EmailVerificationCode, User
from app.schemas.auth import AuthResponse
from app.schemas.email_auth import EmailCodeStartResponse
from app.services.auth_service import (
    AuthError,
    get_user_by_email,
    hash_password,
    issue_tokens,
    to_user_response,
)
from app.services.email_service import send_login_code_email


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _hash_code(email: str, code: str) -> str:
    payload = f"{settings.jwt_secret}:{email}:{code}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def _generate_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


async def _count_recent_codes(
    db: AsyncSession,
    *,
    email: str,
    request_ip: str | None,
) -> tuple[int, int]:
    window_start = _utcnow() - timedelta(seconds=settings.email_rate_limit_window_seconds)

    email_count_result = await db.execute(
        select(func.count())
        .select_from(EmailVerificationCode)
        .where(
            EmailVerificationCode.email == email,
            EmailVerificationCode.sent_at >= window_start,
        )
    )
    email_count = int(email_count_result.scalar_one())

    ip_count = 0
    if request_ip:
        ip_count_result = await db.execute(
            select(func.count())
            .select_from(EmailVerificationCode)
            .where(
                EmailVerificationCode.request_ip == request_ip,
                EmailVerificationCode.sent_at >= window_start,
            )
        )
        ip_count = int(ip_count_result.scalar_one())

    return email_count, ip_count


async def _get_latest_pending_code(db: AsyncSession, email: str) -> EmailVerificationCode | None:
    result = await db.execute(
        select(EmailVerificationCode)
        .where(
            EmailVerificationCode.email == email,
            EmailVerificationCode.purpose == "login",
            EmailVerificationCode.consumed_at.is_(None),
        )
        .order_by(EmailVerificationCode.sent_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def start_email_login(
    db: AsyncSession,
    *,
    email: str,
    request_ip: str | None = None,
    user_agent: str | None = None,
) -> EmailCodeStartResponse:
    normalized_email = _normalize_email(email)
    now = _utcnow()
    code = _generate_code()
    code_hash = _hash_code(normalized_email, code)

    email_count, ip_count = await _count_recent_codes(
        db, email=normalized_email, request_ip=request_ip
    )
    if email_count >= settings.email_rate_limit_per_email:
        raise AuthError("Too many verification emails sent to this address", status_code=429)
    if request_ip and ip_count >= settings.email_rate_limit_per_ip:
        raise AuthError("Too many verification emails sent from this IP", status_code=429)

    latest = await _get_latest_pending_code(db, normalized_email)
    if latest is not None:
        resend_delta = now - latest.sent_at
        if resend_delta.total_seconds() < settings.email_code_resend_seconds:
            raise AuthError("Verification code was sent too recently", status_code=429)

    record = EmailVerificationCode(
        email=normalized_email,
        code_hash=code_hash,
        purpose="login",
        sent_at=now,
        expires_at=now + timedelta(seconds=settings.email_code_ttl_seconds),
        created_at=now,
        updated_at=now,
        request_ip=request_ip,
        user_agent=user_agent,
    )
    db.add(record)
    await db.flush()

    await send_login_code_email(normalized_email, code, settings.email_code_ttl_seconds)
    await db.commit()

    return EmailCodeStartResponse(
        email=normalized_email,
        expires_in=settings.email_code_ttl_seconds,
        resend_after_seconds=settings.email_code_resend_seconds,
        debug_code=code if settings.email_debug_return_code else None,
    )


async def verify_email_login(
    db: AsyncSession,
    *,
    email: str,
    code: str,
) -> AuthResponse:
    normalized_email = _normalize_email(email)
    pending = await _get_latest_pending_code(db, normalized_email)
    if pending is None:
        raise AuthError("Verification code expired or not found", status_code=401)

    now = _utcnow()
    if pending.expires_at <= now:
        pending.consumed_at = now
        await db.commit()
        raise AuthError("Verification code expired or not found", status_code=401)

    if pending.attempt_count >= settings.email_code_max_attempts:
        raise AuthError("Too many invalid attempts", status_code=429)

    submitted_code = code.strip()
    if _hash_code(normalized_email, submitted_code) != pending.code_hash:
        pending.attempt_count += 1
        if pending.attempt_count >= settings.email_code_max_attempts:
            pending.consumed_at = now
        await db.commit()
        if pending.attempt_count >= settings.email_code_max_attempts:
            raise AuthError("Too many invalid attempts", status_code=429)
        raise AuthError("Invalid verification code", status_code=401)

    pending.consumed_at = now
    await db.flush()

    user = await get_user_by_email(db, normalized_email)
    if user is None:
        user = User(
            email=normalized_email,
            password_hash=hash_password(uuid.uuid4().hex),
            nickname=normalized_email.split("@", 1)[0],
            created_at=now,
            updated_at=now,
        )
        db.add(user)
        await db.flush()

    tokens = await issue_tokens(db, user)
    return AuthResponse(user=to_user_response(user), tokens=tokens)
