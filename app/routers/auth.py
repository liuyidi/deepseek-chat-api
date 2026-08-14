from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

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
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    try:
        return await refresh_tokens(db, body.refresh_token)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/logout", status_code=204)
async def logout(body: LogoutRequest, db: AsyncSession = Depends(get_db)) -> None:
    try:
        await logout_user(db, body.refresh_token)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
