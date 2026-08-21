import base64
import hashlib
import json
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from urllib.parse import urlparse

from fastapi import HTTPException, status
from jose import JWTError, jwt
from sqlalchemy import insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user import AuthClient, DeviceAuthorizationRequest, User
from app.schemas.auth import TokenResponse
from app.schemas.oidc import DeviceRequestSnapshot, DeviceStartResponse
from app.services.auth_service import AuthError, issue_tokens, to_user_response
from app.services.admin_service import _load_list
from app.services.consent_service import upsert_oauth_consent
from app.services.request_context import SessionMeta

OIDC_CODE_LIFETIME_MINUTES = 5
DEVICE_CODE_LIFETIME_SECONDS = 900
DEVICE_CODE_INTERVAL_SECONDS = 5


def _utcnow() -> datetime:
    return datetime.now(UTC)


def is_custom_scheme_redirect_uri(redirect_uri: str) -> bool:
    """True when redirect_uri uses a non-http(s) scheme (e.g. minibot://)."""
    parsed = urlparse((redirect_uri or "").strip())
    scheme = (parsed.scheme or "").lower()
    return bool(scheme) and scheme not in {"http", "https"}


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_json(data: dict) -> str:
    return _b64url(json.dumps(data, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))


def _hash_code_verifier(verifier: str) -> str:
    return _b64url(hashlib.sha256(verifier.encode("utf-8")).digest())


def normalize_scopes(scope: str | None) -> list[str]:
    if not scope:
        return ["openid", "profile", "email"]
    return [item for item in scope.split() if item]


def build_discovery_document() -> dict:
    base = settings.jwt_issuer.rstrip("/")
    return {
        "issuer": settings.jwt_issuer,
        "authorization_endpoint": f"{base}/oauth/authorize",
        "token_endpoint": f"{base}/oauth/token",
        "userinfo_endpoint": f"{base}/oauth/userinfo",
        "jwks_uri": f"{base}/oauth/jwks.json",
        "response_types_supported": ["code"],
        "subject_types_supported": ["public"],
        "id_token_signing_alg_values_supported": ["HS256"],
        "scopes_supported": ["openid", "profile", "email"],
        "grant_types_supported": ["authorization_code", "refresh_token", "device_code"],
        "token_endpoint_auth_methods_supported": ["none"],
    }


def build_jwks() -> dict:
    secret_bytes = settings.jwt_secret.encode("utf-8")
    kid = _b64url(hashlib.sha256(secret_bytes).digest()[:12])
    return {
        "keys": [
            {
                "kty": "oct",
                "kid": kid,
                "use": "sig",
                "alg": "HS256",
                "k": _b64url(secret_bytes),
            }
        ]
    }


def _encode_auth_code(
    *,
    user_id: uuid.UUID,
    client_id: str,
    redirect_uri: str,
    code_challenge: str,
    code_challenge_method: str,
    scope: list[str],
    nonce: str | None,
) -> str:
    now = _utcnow()
    payload = {
        "sub": str(user_id),
        "aud": client_id,
        "iss": settings.jwt_issuer,
        "iat": int(now.timestamp()),
        "nbf": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=OIDC_CODE_LIFETIME_MINUTES)).timestamp()),
        "jti": str(uuid.uuid4()),
        "token_use": "authorization_code",
        "redirect_uri": redirect_uri,
        "code_challenge": code_challenge,
        "code_challenge_method": code_challenge_method,
        "scope": " ".join(scope),
        "nonce": nonce,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def create_authorization_code(
    *,
    user_id: uuid.UUID,
    client_id: str,
    redirect_uri: str,
    code_challenge: str,
    code_challenge_method: str,
    scope: list[str],
    nonce: str | None,
) -> str:
    return _encode_auth_code(
        user_id=user_id,
        client_id=client_id,
        redirect_uri=redirect_uri,
        code_challenge=code_challenge,
        code_challenge_method=code_challenge_method,
        scope=scope,
        nonce=nonce,
    )


def _decode_auth_code(code: str, *, client_id: str) -> dict:
    try:
        payload = jwt.decode(
            code,
            settings.jwt_secret,
            algorithms=["HS256"],
            audience=client_id,
            issuer=settings.jwt_issuer,
        )
    except JWTError as exc:
        raise AuthError("Invalid or expired authorization code", status_code=401) from exc

    if payload.get("token_use") != "authorization_code":
        raise AuthError("Invalid authorization code", status_code=401)
    return payload


def _verify_pkce(*, payload: dict, code_verifier: str) -> None:
    method = payload.get("code_challenge_method") or "S256"
    expected = payload.get("code_challenge")
    if not isinstance(expected, str) or not expected:
        raise AuthError("Missing code challenge", status_code=400)

    if method == "S256":
        actual = _hash_code_verifier(code_verifier)
    elif method == "plain":
        actual = code_verifier
    else:
        raise AuthError("Unsupported code challenge method", status_code=400)

    if actual != expected:
        raise AuthError("Invalid code verifier", status_code=401)


async def _get_client(db: AsyncSession, client_id: str) -> AuthClient | None:
    result = await db.execute(select(AuthClient).where(AuthClient.client_id == client_id))
    return result.scalar_one_or_none()


def _parse_redirect_uris(raw: str) -> list[str]:
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            return [str(item).strip() for item in parsed if str(item).strip()]
    except json.JSONDecodeError:
        pass
    return [item.strip() for item in raw.replace("\n", ",").split(",") if item.strip()]


async def validate_client_redirect_uri(
    db: AsyncSession, *, client_id: str, redirect_uri: str
) -> None:
    client = await _get_client(db, client_id)
    if client is None:
        raise AuthError("Unknown client", status_code=404)
    if redirect_uri not in _parse_redirect_uris(client.redirect_uris):
        raise AuthError("Invalid redirect_uri", status_code=400)
    if client.status != "active":
        raise AuthError("Client disabled", status_code=403)


async def validate_client_scopes(
    db: AsyncSession, *, client_id: str, requested_scopes: list[str]
) -> None:
    client = await _get_client(db, client_id)
    if client is None:
        raise AuthError("Unknown client", status_code=404)
    allowed = set(_load_list(client.allowed_scopes))
    requested = set(requested_scopes)
    if not requested.issubset(allowed):
        raise AuthError("Scope not allowed for client", status_code=400)


async def exchange_authorization_code(
    db: AsyncSession,
    *,
    code: str,
    client_id: str,
    redirect_uri: str,
    code_verifier: str,
    meta: SessionMeta | None = None,
) -> TokenResponse:
    payload = _decode_auth_code(code, client_id=client_id)
    if payload.get("redirect_uri") != redirect_uri:
        raise AuthError("Invalid redirect_uri", status_code=400)

    await validate_client_redirect_uri(db, client_id=client_id, redirect_uri=redirect_uri)
    _verify_pkce(payload=payload, code_verifier=code_verifier)

    user_id = uuid.UUID(payload["sub"])
    result = await db.execute(select(User).where(User.id == user_id, User.deleted_at.is_(None)))
    user = result.scalar_one_or_none()
    if user is None:
        raise AuthError("User not found", status_code=401)

    scope = normalize_scopes(payload.get("scope"))
    scope_text = " ".join(scope)
    include_id_token = "openid" in scope
    await upsert_oauth_consent(
        db,
        user_id=user.id,
        client_id=client_id,
        scopes=scope_text,
    )
    return await issue_tokens(
        db,
        user,
        client_id=client_id,
        nonce=payload.get("nonce"),
        include_id_token=include_id_token,
        meta=meta,
        audit_action="login.oauth.code",
    )


def userinfo_from_user(user: User) -> dict:
    identities = [
        {
            "provider": identity.provider,
            "display_name": identity.display_name,
        }
        for identity in (user.identities or [])
    ]
    return {
        "sub": str(user.id),
        "email": user.email,
        "email_verified": True,
        "preferred_username": user.nickname,
        "name": user.nickname,
        "picture": user.avatar_url,
        "phone_number": user.phone,
        "identities": identities,
    }


def code_challenge_s256(code_verifier: str) -> str:
    return _hash_code_verifier(code_verifier)


def raise_http_error(message: str, status_code: int) -> HTTPException:
    return HTTPException(status_code=status_code, detail=message)


def _generate_user_code() -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    raw = "".join(secrets.choice(alphabet) for _ in range(8))
    return f"{raw[:4]}-{raw[4:]}"


def _generate_device_code() -> str:
    return secrets.token_urlsafe(32)


def _device_request_select_columns() -> list:
    return [
        DeviceAuthorizationRequest.device_code,
        DeviceAuthorizationRequest.user_code,
        DeviceAuthorizationRequest.client_id,
        DeviceAuthorizationRequest.scope,
        DeviceAuthorizationRequest.verification_uri,
        DeviceAuthorizationRequest.device_label,
        DeviceAuthorizationRequest.location,
        DeviceAuthorizationRequest.ip_address,
        DeviceAuthorizationRequest.user_agent,
        DeviceAuthorizationRequest.expires_at,
        DeviceAuthorizationRequest.interval,
        DeviceAuthorizationRequest.status,
        DeviceAuthorizationRequest.approved_user_id,
        DeviceAuthorizationRequest.approved_at,
        DeviceAuthorizationRequest.denied_at,
        DeviceAuthorizationRequest.consumed_at,
        DeviceAuthorizationRequest.created_at,
    ]


async def _load_device_request_row(db: AsyncSession, user_code: str) -> dict | None:
    try:
        result = await db.execute(
            select(*_device_request_select_columns()).where(
                DeviceAuthorizationRequest.user_code == user_code.upper().strip()
            )
        )
    except Exception:
        return None
    row = result.mappings().first()
    if row is None:
        return None
    return dict(row)


async def start_device_authorization(
    db: AsyncSession,
    *,
    client_id: str,
    scope: str,
    verification_uri: str,
    device_label: str | None = None,
    location: str | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> DeviceStartResponse:
    expires_at = _utcnow() + timedelta(seconds=DEVICE_CODE_LIFETIME_SECONDS)
    now = _utcnow()
    device_code = _generate_device_code()
    user_code = _generate_user_code()
    payload: dict[str, object] = {
        "id": uuid.uuid4(),
        "device_code": device_code,
        "user_code": user_code,
        "client_id": client_id,
        "scope": scope,
        "verification_uri": verification_uri,
        "expires_at": expires_at,
        "interval": DEVICE_CODE_INTERVAL_SECONDS,
        "status": "pending",
        "created_at": now,
        "updated_at": now,
        "device_label": device_label,
        "location": location,
        "ip_address": ip_address,
        "user_agent": user_agent,
    }
    await db.execute(insert(DeviceAuthorizationRequest).values(**payload))
    await db.commit()
    return DeviceStartResponse(
        device_code=device_code,
        user_code=user_code,
        verification_uri=verification_uri,
        verification_uri_complete=f"{verification_uri}?user_code={user_code}",
        expires_in=DEVICE_CODE_LIFETIME_SECONDS,
        interval=DEVICE_CODE_INTERVAL_SECONDS,
    )


async def get_device_request_snapshot(
    db: AsyncSession,
    *,
    user_code: str,
) -> DeviceRequestSnapshot | None:
    row = await _load_device_request_row(db, user_code)
    if row is None:
        return None
    created_at = row.get("created_at")
    if hasattr(created_at, "isoformat"):
        created_at_value = created_at.isoformat()
    else:
        created_at_value = str(created_at or _utcnow().isoformat())
    approved_at = row.get("approved_at")
    approved_at_value = approved_at.isoformat() if hasattr(approved_at, "isoformat") and approved_at else None
    return DeviceRequestSnapshot(
        user_code=row.get("user_code", user_code.upper().strip()),
        client_id=row.get("client_id", ""),
        scope=row.get("scope", "openid profile email"),
        verification_uri=row.get("verification_uri", ""),
        device_label=row.get("device_label") or "Unknown device",
        location=row.get("location"),
        created_at=created_at_value,
        ip_address=row.get("ip_address"),
        user_agent=row.get("user_agent"),
        status=row.get("status", "pending"),
        approved_user=None,
        approved_at=approved_at_value,
    )


async def get_device_request_by_user_code(
    db: AsyncSession, user_code: str
) -> DeviceAuthorizationRequest | None:
    row = await _load_device_request_row(db, user_code)
    if row is None:
        return None
    return DeviceAuthorizationRequest(**row)


async def confirm_device_authorization(
    db: AsyncSession,
    *,
    user_code: str,
    user: User | None,
    approve: bool,
) -> DeviceAuthorizationRequest:
    row = await _load_device_request_row(db, user_code)
    if row is None:
        raise AuthError("Invalid or expired user_code", status_code=400)
    expires_at = row.get("expires_at")
    if hasattr(expires_at, "__le__") and expires_at <= _utcnow():
        await db.execute(
            update(DeviceAuthorizationRequest)
            .where(DeviceAuthorizationRequest.user_code == user_code.upper().strip())
            .values(status="expired")
        )
        await db.commit()
        raise AuthError("Expired device code", status_code=400)
    if row.get("status") != "pending":
        raise AuthError("Device code already used", status_code=400)
    if approve:
        if user is None:
            raise AuthError("Login required", status_code=401)
        values = {"status": "approved"}
        values["approved_user_id"] = user.id
        values["approved_at"] = _utcnow()
        await db.execute(
            update(DeviceAuthorizationRequest)
            .where(DeviceAuthorizationRequest.user_code == user_code.upper().strip())
            .values(**values)
        )
    else:
        values = {"status": "denied"}
        values["denied_at"] = _utcnow()
        await db.execute(
            update(DeviceAuthorizationRequest)
            .where(DeviceAuthorizationRequest.user_code == user_code.upper().strip())
            .values(**values)
        )
    await db.commit()
    return SimpleNamespace(user_code=user_code.upper().strip(), status="approved" if approve else "denied")


class DeviceTokenPendingError(Exception):
    def __init__(self, code: str) -> None:
        self.code = code
        super().__init__(code)


async def exchange_device_code(
    db: AsyncSession,
    *,
    client_id: str,
    device_code: str,
    meta: SessionMeta | None = None,
) -> TokenResponse:
    result = await db.execute(
        select(
            DeviceAuthorizationRequest.device_code,
            DeviceAuthorizationRequest.user_code,
            DeviceAuthorizationRequest.client_id,
            DeviceAuthorizationRequest.scope,
            DeviceAuthorizationRequest.expires_at,
            DeviceAuthorizationRequest.status,
            DeviceAuthorizationRequest.approved_user_id,
            DeviceAuthorizationRequest.consumed_at,
            DeviceAuthorizationRequest.device_label,
            DeviceAuthorizationRequest.location,
            DeviceAuthorizationRequest.ip_address,
            DeviceAuthorizationRequest.user_agent,
        ).where(
            DeviceAuthorizationRequest.device_code == device_code.strip(),
            DeviceAuthorizationRequest.client_id == client_id,
        )
    )
    record = result.mappings().first()
    if record is None:
        raise AuthError("Invalid device_code", status_code=400)
    if record.get("expires_at") <= _utcnow():
        await db.execute(
            update(DeviceAuthorizationRequest)
            .where(DeviceAuthorizationRequest.device_code == device_code.strip())
            .values(status="expired")
        )
        await db.commit()
        raise DeviceTokenPendingError("expired_token")
    if record.get("status") == "pending":
        raise DeviceTokenPendingError("authorization_pending")
    if record.get("status") == "denied":
        raise DeviceTokenPendingError("access_denied")
    if record.get("status") != "approved" or record.get("approved_user_id") is None:
        raise DeviceTokenPendingError("authorization_pending")
    if record.get("consumed_at") is not None:
        raise AuthError("Device code already used", status_code=400)

    result = await db.execute(
        select(User).where(User.id == record["approved_user_id"], User.deleted_at.is_(None))
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise AuthError("User not found", status_code=401)
    await db.execute(
        update(DeviceAuthorizationRequest)
        .where(DeviceAuthorizationRequest.device_code == device_code.strip())
        .values(consumed_at=_utcnow())
    )
    await db.flush()
    scope = normalize_scopes(record.get("scope"))
    scope_text = " ".join(scope)
    include_id_token = "openid" in scope
    device_meta = SessionMeta(
        user_agent=record.get("user_agent") or (meta.user_agent if meta else None),
        ip_address=record.get("ip_address") or (meta.ip_address if meta else None),
        device_label=record.get("device_label") or (meta.device_label if meta else None),
        location=record.get("location") or (meta.location if meta else None),
    )
    await upsert_oauth_consent(
        db,
        user_id=user.id,
        client_id=client_id,
        scopes=scope_text,
    )
    return await issue_tokens(
        db,
        user,
        client_id=client_id,
        include_id_token=include_id_token,
        meta=device_meta,
        audit_action="login.oauth.device",
    )
