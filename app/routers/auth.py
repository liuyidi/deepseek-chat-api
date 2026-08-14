from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.schemas.auth import (
    AuthResponse,
    DemoLoginRequest,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
)
from app.schemas.email_auth import EmailCodeStartRequest, EmailCodeStartResponse, EmailCodeVerifyRequest
from app.services.auth_service import (
    AuthError,
    demo_login_user,
    login_user,
    logout_user,
    refresh_tokens,
    register_user,
)
from app.services.email_auth_service import start_email_login, verify_email_login

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse, status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)) -> AuthResponse:
    try:
        return await register_user(
            db,
            email=body.email,
            password=body.password,
            nickname=body.nickname,
        )
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)) -> AuthResponse:
    try:
        return await login_user(db, email=body.email, password=body.password)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/demo-login", response_model=AuthResponse)
async def demo_login(body: DemoLoginRequest, db: AsyncSession = Depends(get_db)) -> AuthResponse:
    try:
        return await demo_login_user(db, email=body.email, nickname=body.nickname)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/email/start", response_model=EmailCodeStartResponse)
async def email_start(
    body: EmailCodeStartRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> EmailCodeStartResponse:
    try:
        return await start_email_login(
            db,
            email=body.email,
            request_ip=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/email/verify", response_model=AuthResponse)
async def email_verify(body: EmailCodeVerifyRequest, db: AsyncSession = Depends(get_db)) -> AuthResponse:
    try:
        return await verify_email_login(db, email=body.email, code=body.code, nickname=body.nickname)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    request: Request,
    response: Response,
    body: RefreshRequest | None = None,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    cookie_flow = body is None
    refresh_token = body.refresh_token if body is not None else request.cookies.get("mini_auth_refresh_token", "")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token required")
    try:
        tokens = await refresh_tokens(db, refresh_token)
        if cookie_flow:
            response.set_cookie(
                "mini_auth_access_token",
                tokens.access_token,
                max_age=tokens.expires_in,
                httponly=True,
                secure=settings.external_auth_cookie_secure,
                samesite="lax",
                path="/",
            )
            response.set_cookie(
                "mini_auth_refresh_token",
                tokens.refresh_token,
                max_age=settings.jwt_refresh_expire_days * 86400,
                httponly=True,
                secure=settings.external_auth_cookie_secure,
                samesite="lax",
                path="/",
            )
        return tokens
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/logout", status_code=204)
async def logout(body: LogoutRequest, db: AsyncSession = Depends(get_db)) -> None:
    try:
        await logout_user(db, body.refresh_token)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
