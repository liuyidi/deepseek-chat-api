import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from starlette.requests import Request
from starlette.responses import Response

from app.routers.auth import refresh
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


if __name__ == "__main__":
    unittest.main()
