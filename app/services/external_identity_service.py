import secrets

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserIdentity
from app.services.auth_service import get_user_by_email, hash_password
from app.services.external_auth_types import ExternalAuthError, ProviderIdentity


def _build_identity(user: User, identity: ProviderIdentity, email: str) -> UserIdentity:
    return UserIdentity(
        user=user,
        provider=identity.provider,
        provider_subject=identity.subject,
        provider_union_id=identity.union_id,
        email=email,
        email_verified=True,
        display_name=identity.display_name,
        avatar_url=identity.avatar_url,
    )


async def _link_identity(db: AsyncSession, user: User, identity: ProviderIdentity, email: str) -> User:
    db.add(_build_identity(user, identity, email))
    try:
        await db.commit()
        return user
    except IntegrityError as exc:
        await db.rollback()
        raced = await db.execute(
            select(UserIdentity).where(
                UserIdentity.provider == identity.provider,
                UserIdentity.provider_subject == identity.subject,
            )
        )
        existing_identity = raced.scalar_one_or_none()
        if existing_identity is not None and existing_identity.user.deleted_at is None:
            return existing_identity.user
        raise ExternalAuthError("external_identity_conflict", status_code=409) from exc


async def resolve_external_identity(db: AsyncSession, identity: ProviderIdentity) -> User:
    result = await db.execute(
        select(UserIdentity).where(
            UserIdentity.provider == identity.provider,
            UserIdentity.provider_subject == identity.subject,
        )
    )
    existing = result.scalar_one_or_none()
    if existing is not None:
        if existing.user.deleted_at is not None:
            raise ExternalAuthError("external_identity_invalid", status_code=401)
        existing.email = identity.email.lower() if identity.email else None
        existing.email_verified = identity.email_verified
        existing.display_name = identity.display_name
        existing.avatar_url = identity.avatar_url
        await db.commit()
        return existing.user

    if not identity.email or identity.email_verified is not True:
        raise ExternalAuthError("verified_email_required", status_code=422)
    email = identity.email.strip().lower()

    existing_user = await get_user_by_email(db, email)
    if existing_user is not None:
        return await _link_identity(db, existing_user, identity, email)

    user = User(
        email=email,
        password_hash=hash_password(secrets.token_urlsafe(48)),
        nickname=identity.display_name or f"{identity.provider} 用户",
        avatar_url=identity.avatar_url,
    )
    db.add(user)
    await db.flush()
    db.add(_build_identity(user, identity, email))
    try:
        await db.commit()
        return user
    except IntegrityError as exc:
        await db.rollback()
        raced = await db.execute(
            select(UserIdentity).where(
                UserIdentity.provider == identity.provider,
                UserIdentity.provider_subject == identity.subject,
            )
        )
        existing_identity = raced.scalar_one_or_none()
        if existing_identity is not None and existing_identity.user.deleted_at is None:
            return existing_identity.user
        raced_user = await get_user_by_email(db, email)
        if raced_user is not None:
            return await _link_identity(db, raced_user, identity, email)
        raise ExternalAuthError("external_identity_conflict", status_code=409) from exc
