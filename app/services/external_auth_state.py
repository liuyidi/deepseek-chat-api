import base64
import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from urllib.parse import urlsplit

from jose import JWTError, jwt

from app.config import settings
from app.services.external_auth_types import ExternalAuthError, OAuthState

ALGORITHM = "HS256"
AUDIENCE = "mini-auth-external-oauth"
PURPOSE = "external_oauth_context"


def normalize_return_url(value: str | None) -> str:
    candidate = (value or "/").strip()
    parsed = urlsplit(candidate)
    if parsed.fragment or parsed.username or parsed.password:
        raise ExternalAuthError("invalid_return_url")

    if not parsed.scheme and not parsed.netloc:
        if not candidate.startswith("/") or candidate.startswith("//"):
            raise ExternalAuthError("invalid_return_url")
        return candidate

    if parsed.scheme != "https" or not parsed.hostname:
        raise ExternalAuthError("invalid_return_url")
    origin = f"{parsed.scheme}://{parsed.hostname}"
    if parsed.port is not None:
        origin += f":{parsed.port}"
    if origin not in settings.external_auth_allowed_return_origin_list:
        raise ExternalAuthError("invalid_return_url")
    return candidate


def _pkce_challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


def create_oauth_context(provider: str, next_url: str) -> tuple[str, str, str]:
    now = datetime.now(UTC)
    state = secrets.token_urlsafe(32)
    verifier = secrets.token_urlsafe(64)
    payload = {
        "provider": provider,
        "state": state,
        "code_verifier": verifier,
        "next_url": normalize_return_url(next_url),
        "purpose": PURPOSE,
        "aud": AUDIENCE,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=settings.external_auth_context_expire_seconds)).timestamp()),
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)
    return token, state, _pkce_challenge(verifier)


def decode_oauth_context(token: str, provider: str, state: str) -> OAuthState:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM], audience=AUDIENCE)
    except JWTError as exc:
        raise ExternalAuthError("oauth_state_invalid") from exc
    if (
        payload.get("purpose") != PURPOSE
        or payload.get("provider") != provider
        or not secrets.compare_digest(str(payload.get("state", "")), state)
    ):
        raise ExternalAuthError("oauth_state_invalid")
    verifier = payload.get("code_verifier")
    next_url = payload.get("next_url")
    if not isinstance(verifier, str) or not isinstance(next_url, str):
        raise ExternalAuthError("oauth_state_invalid")
    return OAuthState(provider=provider, state=state, code_verifier=verifier, next_url=normalize_return_url(next_url))


__all__ = ["ExternalAuthError", "create_oauth_context", "decode_oauth_context", "normalize_return_url"]
