from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from starlette.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, resolve_current_user
from app.models.user import User
from app.schemas.auth import TokenResponse
from app.schemas.oidc import OidcTokenRequest, OidcUserInfo
from app.services.auth_service import AuthError
from app.services.oidc_service import (
    build_discovery_document,
    build_jwks,
    create_authorization_code,
    exchange_authorization_code,
    normalize_scopes,
    userinfo_from_user,
    validate_client_redirect_uri,
    validate_client_scopes,
)

discovery_router = APIRouter(tags=["oidc"], include_in_schema=False)
router = APIRouter(prefix="/oauth", tags=["oidc"])


def _raise_http_error(exc: AuthError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


@discovery_router.get("/.well-known/openid-configuration")
async def openid_configuration() -> dict:
    return build_discovery_document()


@router.get("/jwks.json")
async def jwks() -> dict:
    return build_jwks()


@router.get("/authorize")
async def authorize(
    request: Request,
    response_type: str = Query(default="code"),
    client_id: str = Query(...),
    redirect_uri: str = Query(...),
    scope: str = Query(default="openid profile email"),
    state: str | None = Query(default=None),
    code_challenge: str | None = Query(default=None),
    code_challenge_method: str = Query(default="S256"),
    nonce: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    try:
        if response_type != "code":
            raise AuthError("Unsupported response_type", status_code=400)

        scope_items = normalize_scopes(scope)
        if "openid" not in scope_items:
            raise AuthError("openid scope is required", status_code=400)

        current_user = await resolve_current_user(request, db)
        if current_user is None:
            next_url = str(request.url)
            return RedirectResponse(url=f"/login?next={quote(next_url, safe='')}", status_code=302)

        await validate_client_redirect_uri(db, client_id=client_id, redirect_uri=redirect_uri)
        await validate_client_scopes(db, client_id=client_id, requested_scopes=scope_items)
        if not code_challenge:
            raise AuthError("PKCE code_challenge is required.", status_code=400)
        code = create_authorization_code(
            user_id=current_user.id,
            client_id=client_id,
            redirect_uri=redirect_uri,
            code_challenge=code_challenge,
            code_challenge_method=code_challenge_method,
            scope=scope_items,
            nonce=nonce,
        )

        location = f"{redirect_uri}?code={code}"
        if state:
            location = f"{location}&state={state}"
        return RedirectResponse(url=location, status_code=302)
    except AuthError as exc:
        raise _raise_http_error(exc) from exc


@router.post("/token", response_model=TokenResponse)
async def token(body: OidcTokenRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    try:
        return await exchange_authorization_code(
            db,
            code=body.code,
            client_id=body.client_id,
            redirect_uri=body.redirect_uri,
            code_verifier=body.code_verifier,
        )
    except AuthError as exc:
        raise _raise_http_error(exc) from exc


@router.get("/userinfo", response_model=OidcUserInfo)
async def userinfo(current_user: User = Depends(get_current_user)) -> OidcUserInfo:
    return OidcUserInfo(**userinfo_from_user(current_user))
