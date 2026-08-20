from urllib.parse import quote, urlencode

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, resolve_current_user
from app.models.user import User
from app.schemas.auth import TokenResponse
from app.schemas.oidc import DeviceConfirmRequest, DeviceStartRequest, OidcTokenRequest, OidcUserInfo
from app.services.auth_service import AuthError
from app.services.oidc_service import (
    DeviceTokenPendingError,
    build_discovery_document,
    build_jwks,
    confirm_device_authorization,
    create_authorization_code,
    exchange_device_code,
    exchange_authorization_code,
    is_custom_scheme_redirect_uri,
    get_device_request_snapshot,
    normalize_scopes,
    start_device_authorization,
    userinfo_from_user,
    validate_client_redirect_uri,
    validate_client_scopes,
)


def _select_account_location(request: Request) -> str:
    pairs = [(key, value) for key, value in request.query_params.multi_items() if key != "account_confirmed"]
    query = urlencode(pairs)
    return f"/oauth/select-account?{query}" if query else "/oauth/select-account"

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
    account_confirmed: str | None = Query(default=None),
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

        confirmed = (account_confirmed or "").strip() == "1"
        if is_custom_scheme_redirect_uri(redirect_uri) and not confirmed:
            return RedirectResponse(url=_select_account_location(request), status_code=302)

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
        if body.grant_type == "device_code":
            if not body.device_code:
                raise AuthError("device_code is required", status_code=400)
            return await exchange_device_code(
                db,
                client_id=body.client_id,
                device_code=body.device_code,
            )
        return await exchange_authorization_code(
            db,
            code=body.code,
            client_id=body.client_id,
            redirect_uri=body.redirect_uri or "",
            code_verifier=body.code_verifier or "",
        )
    except AuthError as exc:
        raise _raise_http_error(exc) from exc
    except DeviceTokenPendingError as exc:
        raise HTTPException(status_code=400, detail=exc.code) from exc


@router.post("/device/start")
async def device_start(
    body: DeviceStartRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    verification_uri = str(request.base_url).rstrip("/") + "/oauth/device"
    user_agent = request.headers.get("user-agent")
    device_label = request.headers.get("x-device-label") or user_agent
    location = request.headers.get("x-device-location")
    client_host = request.client.host if request.client else None
    return await start_device_authorization(
        db,
        client_id=body.client_id,
        scope=body.scope,
        verification_uri=verification_uri,
        device_label=device_label,
        location=location,
        ip_address=client_host,
        user_agent=user_agent,
    )


@router.get("/device/request")
async def device_request(
    user_code: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    snapshot = await get_device_request_snapshot(db, user_code=user_code)
    if snapshot is None:
        raise HTTPException(status_code=404, detail="Device request not found")
    return snapshot


@router.post("/device/confirm")
async def device_confirm(
    body: DeviceConfirmRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
):
    try:
        record = await confirm_device_authorization(
            db,
            user_code=body.user_code,
            user=current_user,
            approve=body.approve,
        )
        return {
            "status": record.status,
            "user_code": record.user_code,
        }
    except AuthError as exc:
        raise _raise_http_error(exc) from exc


@router.get("/userinfo", response_model=OidcUserInfo)
async def userinfo(current_user: User = Depends(get_current_user)) -> OidcUserInfo:
    return OidcUserInfo(**userinfo_from_user(current_user))
