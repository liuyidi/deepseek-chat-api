from fastapi import Header, HTTPException, status

from app.config import settings


def require_admin_api_key(x_admin_api_key: str | None = Header(default=None)) -> None:
    if not settings.auth_admin_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin API key is not configured",
        )
    if x_admin_api_key != settings.auth_admin_api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin API key")
