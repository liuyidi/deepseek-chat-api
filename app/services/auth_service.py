import hashlib
import uuid
from datetime import UTC, datetime, timedelta

import bcrypt
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user import AuthSession, RefreshToken, User
from app.schemas.auth import AuthResponse, TokenResponse, UserResponse

ALGORITHM = "HS256"


class AuthError(Exception):
    def __init__(self, message: str, status_code: int = 400) -> None:
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _numeric_timestamp(value: datetime) -> int:
    return int(value.timestamp())


def _build_token_payload(
    *,
    user_id: uuid.UUID,
    session_id: uuid.UUID,
    token_use: str,
    expires_at: datetime,
    jti: str,
) -> dict:
    now = _utcnow()
    now_ts = _numeric_timestamp(now)
    return {
        "sub": str(user_id),
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
        "iat": now_ts,
        "nbf": now_ts,
        "exp": _numeric_timestamp(expires_at),
        "jti": jti,
        "sid": str(session_id),
        "token_use": token_use,
    }


def create_access_token(user_id: uuid.UUID, session_id: uuid.UUID) -> tuple[str, int]:
    expires_minutes = settings.jwt_access_expire_minutes
    expire = _utcnow() + timedelta(minutes=expires_minutes)
    payload = _build_token_payload(
        user_id=user_id,
        session_id=session_id,
        token_use="access",
        expires_at=expire,
        jti=str(uuid.uuid4()),
    )
    token = jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)
    return token, expires_minutes * 60


def create_id_token(
    user_id: uuid.UUID,
    session_id: uuid.UUID,
    *,
    client_id: str,
    nonce: str | None = None,
) -> str:
    expires_minutes = settings.jwt_access_expire_minutes
    expire = _utcnow() + timedelta(minutes=expires_minutes)
    payload = _build_token_payload(
        user_id=user_id,
        session_id=session_id,
        token_use="id_token",
        expires_at=expire,
        jti=str(uuid.uuid4()),
    )
    payload["aud"] = client_id
    payload["azp"] = client_id
    if nonce:
        payload["nonce"] = nonce
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def create_refresh_token(user_id: uuid.UUID, session_id: uuid.UUID) -> tuple[str, datetime, str, str]:
    jti = str(uuid.uuid4())
    expire = _utcnow() + timedelta(days=settings.jwt_refresh_expire_days)
    payload = _build_token_payload(
        user_id=user_id,
        session_id=session_id,
        token_use="refresh",
        expires_at=expire,
        jti=jti,
    )
    token = jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)
    return token, expire, hash_refresh_token(token), jti


def decode_token(
    token: str,
    *,
    audience: str | None = None,
    issuer: str | None = None,
) -> dict:
    try:
        decode_kwargs: dict[str, str] = {}
        if audience is not None:
            decode_kwargs["audience"] = audience
        if issuer is not None:
            decode_kwargs["issuer"] = issuer
        return jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[ALGORITHM],
            **decode_kwargs,
        )
    except JWTError as exc:
        raise AuthError("Invalid or expired token", status_code=401) from exc


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(
        select(User).where(User.email == email.lower(), User.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    result = await db.execute(
        select(User).where(User.id == user_id, User.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


def to_user_response(user: User) -> UserResponse:
    return UserResponse.model_validate(user)


async def _create_session(db: AsyncSession, user: User, *, client_id: str | None = None) -> AuthSession:
    session = AuthSession(
        user_id=user.id,
        client_id=client_id,
        expires_at=_utcnow() + timedelta(days=settings.jwt_refresh_expire_days),
    )
    db.add(session)
    await db.flush()
    return session


async def _load_refresh_bundle(
    db: AsyncSession, refresh_token: str, jti: str
) -> tuple[RefreshToken, AuthSession] | None:
    token_hash = hash_refresh_token(refresh_token)
    result = await db.execute(
        select(RefreshToken, AuthSession)
        .join(AuthSession, RefreshToken.session_id == AuthSession.id)
        .where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.jti == jti,
            RefreshToken.expires_at > _utcnow(),
            RefreshToken.revoked_at.is_(None),
            AuthSession.revoked_at.is_(None),
            AuthSession.expires_at > _utcnow(),
        )
    )
    row = result.first()
    if row is None:
        return None
    return row[0], row[1]


async def issue_tokens(
    db: AsyncSession,
    user: User,
    *,
    session: AuthSession | None = None,
    client_id: str | None = None,
    nonce: str | None = None,
    include_id_token: bool = False,
) -> TokenResponse:
    return await issue_tokens_with_rotation(
        db,
        user,
        session=session,
        client_id=client_id,
        nonce=nonce,
        include_id_token=include_id_token,
    )


async def issue_tokens_with_rotation(
    db: AsyncSession,
    user: User,
    *,
    session: AuthSession | None = None,
    client_id: str | None = None,
    nonce: str | None = None,
    include_id_token: bool = False,
    rotated_from_id: uuid.UUID | None = None,
) -> TokenResponse:
    if session is None:
        session = await _create_session(db, user, client_id=client_id)
    elif client_id is not None:
        session.client_id = client_id

    access_token, expires_in = create_access_token(user.id, session.id)
    refresh_token, expires_at, token_hash, jti = create_refresh_token(user.id, session.id)
    id_token = (
        create_id_token(
            user.id,
            session.id,
            client_id=client_id or session.client_id or settings.jwt_audience,
            nonce=nonce,
        )
        if include_id_token
        else None
    )

    session.expires_at = expires_at
    session.last_seen_at = _utcnow()
    db.add(
        RefreshToken(
            session_id=session.id,
            user_id=user.id,
            jti=jti,
            token_hash=token_hash,
            rotated_from_id=rotated_from_id,
            expires_at=expires_at,
        )
    )
    await db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        id_token=id_token,
        expires_in=expires_in,
    )


async def register_user(
    db: AsyncSession,
    *,
    email: str,
    password: str,
    nickname: str | None,
) -> AuthResponse:
    normalized_email = email.lower()
    existing = await get_user_by_email(db, normalized_email)
    if existing is not None:
        raise AuthError("Email already registered", status_code=409)

    user = User(
        email=normalized_email,
        password_hash=hash_password(password),
        nickname=nickname or "mini-auth 用户",
    )
    db.add(user)
    await db.flush()

    tokens = await issue_tokens(db, user)
    return AuthResponse(user=to_user_response(user), tokens=tokens)


async def login_user(db: AsyncSession, *, email: str, password: str) -> AuthResponse:
    user = await get_user_by_email(db, email)
    if user is None or not verify_password(password, user.password_hash):
        raise AuthError("Invalid email or password", status_code=401)

    tokens = await issue_tokens(db, user)
    return AuthResponse(user=to_user_response(user), tokens=tokens)


async def refresh_tokens(db: AsyncSession, refresh_token: str) -> TokenResponse:
    payload = decode_token(
        refresh_token,
        audience=settings.jwt_audience,
        issuer=settings.jwt_issuer,
    )
    if payload.get("token_use") != "refresh":
        raise AuthError("Invalid refresh token", status_code=401)

    user_id = uuid.UUID(payload["sub"])
    jti = payload.get("jti")
    if not isinstance(jti, str) or not jti:
        raise AuthError("Invalid refresh token", status_code=401)

    bundle = await _load_refresh_bundle(db, refresh_token, jti)
    if bundle is None:
        raise AuthError("Refresh token revoked or expired", status_code=401)
    stored, session = bundle

    if stored.user_id != user_id:
        raise AuthError("Refresh token revoked or expired", status_code=401)

    user = await get_user_by_id(db, user_id)
    if user is None:
        raise AuthError("User not found", status_code=401)

    now = _utcnow()
    stored.revoked_at = now
    session.last_seen_at = now
    session.expires_at = now + timedelta(days=settings.jwt_refresh_expire_days)
    await db.flush()
    return await issue_tokens_with_rotation(db, user, session=session, rotated_from_id=stored.id)


async def logout_user(db: AsyncSession, refresh_token: str) -> None:
    payload = decode_token(
        refresh_token,
        audience=settings.jwt_audience,
        issuer=settings.jwt_issuer,
    )
    if payload.get("token_use") != "refresh":
        raise AuthError("Invalid refresh token", status_code=401)

    jti = payload.get("jti")
    if not isinstance(jti, str) or not jti:
        raise AuthError("Invalid refresh token", status_code=401)

    bundle = await _load_refresh_bundle(db, refresh_token, jti)
    if bundle is None:
        await db.commit()
        return

    stored, session = bundle
    now = _utcnow()
    session.revoked_at = now
    session.last_seen_at = now
    stored.revoked_at = now

    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.session_id == session.id,
            RefreshToken.revoked_at.is_(None),
        )
    )
    for token in result.scalars().all():
        token.revoked_at = now

    await db.commit()


def get_user_id_from_access_token(token: str) -> uuid.UUID:
    payload = decode_token(token, audience=settings.jwt_audience, issuer=settings.jwt_issuer)
    if payload.get("token_use") != "access":
        raise AuthError("Invalid access token", status_code=401)
    return uuid.UUID(payload["sub"])
