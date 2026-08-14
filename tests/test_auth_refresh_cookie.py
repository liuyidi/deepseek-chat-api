import unittest
import warnings
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from starlette.requests import Request
from starlette.responses import Response

warnings.filterwarnings("ignore", message="Using `httpx` with `starlette.testclient` is deprecated.*", category=Warning)
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.database import get_db
from app.routers.auth import refresh, router
from app.schemas.auth import TokenResponse


class AuthRefreshCookieTest(unittest.IsolatedAsyncioTestCase):
    async def test_uses_http_only_cookie_when_body_token_is_absent(self) -> None:
        request = Request(
            {
                "type": "http",
                "method": "POST",
                "path": "/api/v1/auth/refresh",
                "headers": [(b"cookie", b"mini_auth_refresh_token=cookie-refresh")],
            }
        )
        tokens = TokenResponse(access_token="access", refresh_token="refresh", expires_in=1800)
        with patch("app.routers.auth.refresh_tokens", new=AsyncMock(return_value=tokens)) as refresh_tokens:
            response = Response()
            result = await refresh(request=request, response=response, body=None, db=MagicMock())

        self.assertIs(result, tokens)
        refresh_tokens.assert_awaited_once_with(unittest.mock.ANY, "cookie-refresh")
        self.assertTrue(any("mini_auth_refresh_token=refresh" in value for value in response.headers.getlist("set-cookie")))

    async def test_http_endpoint_accepts_cookie_without_request_body(self) -> None:
        app = FastAPI()
        app.include_router(router, prefix="/api/v1")

        async def fake_db():
            yield MagicMock()

        app.dependency_overrides[get_db] = fake_db
        tokens = TokenResponse(access_token="access", refresh_token="refresh", expires_in=1800)
        with patch("app.routers.auth.refresh_tokens", new=AsyncMock(return_value=tokens)):
            client = TestClient(app)
            client.cookies.set("mini_auth_refresh_token", "cookie-refresh")
            response = client.post("/api/v1/auth/refresh")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["access_token"], "access")


if __name__ == "__main__":
    unittest.main()
