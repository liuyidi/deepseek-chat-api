from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.services.external_auth_flow_service import complete_external_auth, start_external_auth
from app.services.external_auth_redirect import (
    build_native_oauth_redirect,
    is_native_app_callback,
    resolve_native_redirect_uri,
)
from app.services.external_auth_state import decode_oauth_context
from app.services.external_auth_types import ExternalAuthError
from app.services.github_auth_provider import GitHubAuthProvider
from app.services.request_context import session_meta_from_request

router = APIRouter(prefix="/api/v1/auth/github", tags=["external-auth"])
OAUTH_CONTEXT_COOKIE = "mini_auth_github_oauth_context"
CALLBACK_PATH = "/api/v1/auth/github/callback"


def _provider() -> GitHubAuthProvider:
    if not settings.github_enabled:
        raise ExternalAuthError("provider_disabled", status_code=503)
    if not settings.github_client_id or not settings.github_client_secret:
        raise ExternalAuthError("provider_not_configured", status_code=503)
    return GitHubAuthProvider()


@router.get("/start")
async def github_start(next: str = Query(default="/")) -> RedirectResponse:
    try:
        started = start_external_auth(_provider(), next)
    except ExternalAuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.code) from exc
    response = RedirectResponse(started.authorization_url, status_code=302)
    response.set_cookie(
        OAUTH_CONTEXT_COOKIE,
        started.signed_context,
        max_age=settings.external_auth_context_expire_seconds,
        httponly=True,
        secure=settings.external_auth_cookie_secure,
        samesite="lax",
        path=CALLBACK_PATH,
    )
    return response


@router.get("/callback")
async def github_callback(
    request: Request,
    code: str = Query(default=""),
    state: str = Query(default=""),
    error: str = Query(default=""),
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    signed_context = request.cookies.get(OAUTH_CONTEXT_COOKIE, "")
    next_url = ""
    try:
        provider = _provider()
        if not state or not signed_context:
            raise ExternalAuthError("oauth_state_invalid")
        next_url = decode_oauth_context(signed_context, provider.name, state).next_url
        if error:
            raise ExternalAuthError("oauth_callback_denied")
        if not code:
            raise ExternalAuthError("oauth_state_invalid")
        completed = await complete_external_auth(
            db,
            provider,
            code,
            state,
            signed_context,
            meta=session_meta_from_request(request),
        )
        if is_native_app_callback(completed.next_url):
            redirect_uri = resolve_native_redirect_uri(completed.next_url)
            if not redirect_uri:
                raise ExternalAuthError("invalid_return_url")
            response = build_native_oauth_redirect(redirect_uri, completed.tokens)
        else:
            response = RedirectResponse(completed.next_url, status_code=302)
            response.set_cookie(
                "mini_auth_access_token",
                completed.tokens.access_token,
                max_age=completed.tokens.expires_in,
                httponly=True,
                secure=settings.external_auth_cookie_secure,
                samesite="lax",
                path="/",
            )
            response.set_cookie(
                "mini_auth_refresh_token",
                completed.tokens.refresh_token,
                max_age=settings.jwt_refresh_expire_days * 86400,
                httponly=True,
                secure=settings.external_auth_cookie_secure,
                samesite="lax",
                path="/",
            )
    except ExternalAuthError as exc:
        params = {"oauth_error": exc.code}
        if next_url:
            params["next"] = next_url
        response = RedirectResponse(f"/login?{urlencode(params)}", status_code=302)
    response.delete_cookie(OAUTH_CONTEXT_COOKIE, path=CALLBACK_PATH)
    return response
