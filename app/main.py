import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from app.config import settings
from app.database import async_session_factory, engine
from app.routers.admin import router as admin_router
from app.routers.auth import router as auth_router
from app.routers.github_auth import router as github_auth_router
from app.routers.oidc import discovery_router, router as oidc_router
from app.routers.web import router as web_router
from app.routers.users import router as users_router
from app.services.bootstrap_service import ensure_demo_oauth_client, ensure_minikb_oauth_client

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Verify the database connection is reachable before accepting traffic.
    # This surfaces a misconfigured DATABASE_URL immediately at startup rather
    # than on the first request.
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    async with async_session_factory() as session:
        await ensure_demo_oauth_client(session)
        await ensure_minikb_oauth_client(session)
    logger.info("Database connection verified successfully")
    yield


app = FastAPI(
    title="mini-auth",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    ProxyHeadersMiddleware,
    trusted_hosts="*",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(github_auth_router)
app.include_router(admin_router, prefix="/api/v1")
# Canonical: /api/v1/me. Alias keeps older /api/v1/users/me clients working.
app.include_router(users_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1/users")
app.include_router(web_router)
app.include_router(discovery_router)
app.include_router(oidc_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/")
async def root() -> dict[str, str]:
    return {"login": "/login", "docs": "/docs"}
