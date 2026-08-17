import base64
import hashlib
import json
import uuid
from datetime import UTC, datetime, timedelta
from urllib.parse import urlparse

from fastapi import HTTPException, status
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user import AuthClient, User
from app.schemas.auth import TokenResponse
from app.services.auth_service import AuthError, issue_tokens, to_user_response
from app.services.admin_service import _load_list

OIDC_CODE_LIFETIME_MINUTES = 5


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
        "grant_types_supported": ["authorization_code", "refresh_token"],
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
    include_id_token = "openid" in scope
    return await issue_tokens(
        db,
        user,
        client_id=client_id,
        nonce=payload.get("nonce"),
        include_id_token=include_id_token,
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
