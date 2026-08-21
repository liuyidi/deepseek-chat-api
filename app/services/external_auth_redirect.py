"""Redirect helpers for external OAuth (web cookies vs native deep link)."""

from __future__ import annotations

from urllib.parse import parse_qs, urlencode, urlsplit

from fastapi.responses import RedirectResponse

from app.schemas.auth import TokenResponse

NATIVE_APP_CALLBACK_PATH = "/oauth/app-callback"


def is_native_app_callback(next_url: str) -> bool:
    path = urlsplit(next_url).path
    return path == NATIVE_APP_CALLBACK_PATH or path.rstrip("/") == NATIVE_APP_CALLBACK_PATH.rstrip("/")


def _allowed_native_redirect(uri: str) -> bool:
    """Allow minibot custom scheme and Expo Go / exp.direct URLs."""
    value = (uri or "").strip()
    if not value or "#" in value:
        return False
    return (
        value.startswith("minibot://")
        or value.startswith("exp://")
        or value.startswith("https://auth.expo.io/")
    )


def resolve_native_redirect_uri(next_url: str) -> str | None:
    if not is_native_app_callback(next_url):
        return None
    qs = parse_qs(urlsplit(next_url).query)
    candidates = qs.get("redirect_uri") or []
    if not candidates:
        return "minibot://oauth"
    redirect_uri = candidates[0].strip()
    if not _allowed_native_redirect(redirect_uri):
        return None
    return redirect_uri


def build_native_oauth_redirect(redirect_uri: str, tokens: TokenResponse) -> RedirectResponse:
    """Append tokens to the native redirect URI (query), preserving any existing query."""
    parsed = urlsplit(redirect_uri)
    sep = "&" if parsed.query else "?"
    params = urlencode(
        {
            "access_token": tokens.access_token,
            "refresh_token": tokens.refresh_token,
            "expires_in": str(tokens.expires_in),
        }
    )
    location = f"{redirect_uri}{sep}{params}"
    return RedirectResponse(location, status_code=302)


__all__ = [
    "NATIVE_APP_CALLBACK_PATH",
    "build_native_oauth_redirect",
    "is_native_app_callback",
    "resolve_native_redirect_uri",
]
