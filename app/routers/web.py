from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import RedirectResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.deps import ACCESS_TOKEN_COOKIE
from app.services.auth_service import AuthError, logout_user

router = APIRouter(tags=["web"], include_in_schema=False)

_REFRESH_COOKIE = "mini_auth_refresh_token"


def _normalized_next_url(next_url: str | None) -> str:
    return (next_url or "").strip()


def _clear_session_cookies(response: Response) -> None:
    """Clear auth cookies with the same flags used when they were set.

    Browsers ignore ``delete_cookie`` when Secure/SameSite/HttpOnly do not match
    the original Set-Cookie (common with ``external_auth_cookie_secure=True``).
    """
    secure = bool(settings.external_auth_cookie_secure)
    for name in (ACCESS_TOKEN_COOKIE, _REFRESH_COOKIE):
        response.delete_cookie(
            name,
            path="/",
            secure=secure,
            httponly=True,
            samesite="lax",
        )


@router.get("/logout")
async def logout(
    request: Request,
    next: str = Query(default=""),
    db: AsyncSession = Depends(get_db),
) -> Response:
    refresh = (request.cookies.get(_REFRESH_COOKIE) or "").strip()
    if refresh:
        try:
            await logout_user(db, refresh)
        except AuthError:
            pass

    next_url = _normalized_next_url(next)
    if next_url:
        response: Response = RedirectResponse(url=next_url, status_code=302)
    else:
        response = Response(status_code=204)
    _clear_session_cookies(response)
    return response
