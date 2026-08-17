"""GET /logout must clear Secure session cookies with matching attributes."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.routers import web as web_mod
from app.routers.web import router


def test_logout_clears_secure_auth_cookies() -> None:
    app = FastAPI()
    app.include_router(router)

    async def _override_db():
        yield AsyncMock(spec=AsyncSession)

    app.dependency_overrides[get_db] = _override_db

    with (
        patch.object(web_mod.settings, "external_auth_cookie_secure", True),
        patch.object(web_mod, "logout_user", new_callable=AsyncMock) as logout_user,
    ):
        client = TestClient(app)
        response = client.get(
            "/logout?next=https://example.com/done",
            cookies={
                "mini_auth_access_token": "access",
                "mini_auth_refresh_token": "refresh",
            },
            follow_redirects=False,
        )

    assert response.status_code == 302
    assert response.headers["location"] == "https://example.com/done"
    logout_user.assert_awaited()

    set_cookies = response.headers.get_list("set-cookie")
    joined = "\n".join(set_cookies).lower()
    assert "mini_auth_access_token=" in joined
    assert "mini_auth_refresh_token=" in joined
    assert "secure" in joined
    assert "httponly" in joined
