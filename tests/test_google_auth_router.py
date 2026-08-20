import unittest
import warnings
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI

warnings.filterwarnings(
    "ignore",
    message="Using `httpx` with `starlette.testclient` is deprecated.*",
    category=Warning,
)
from fastapi.testclient import TestClient

from app.database import get_db
from app.routers.google_auth import OAUTH_CONTEXT_COOKIE, router
from app.schemas.auth import TokenResponse
from app.services.external_auth_state import create_oauth_context


class GoogleAuthRouterTest(unittest.TestCase):
    def setUp(self) -> None:
        app = FastAPI()
        app.include_router(router)

        async def fake_db():
            yield SimpleNamespace()

        app.dependency_overrides[get_db] = fake_db
        self.client = TestClient(app)

    def test_start_redirects_and_sets_http_only_context_cookie(self) -> None:
        with (
            patch("app.routers.google_auth.settings.google_enabled", True),
            patch("app.routers.google_auth.settings.google_client_id", "client"),
            patch("app.routers.google_auth.settings.google_client_secret", "secret"),
            patch("app.routers.google_auth.settings.external_auth_cookie_secure", True),
        ):
            response = self.client.get(
                "/api/v1/auth/google/start?next=%2Faccounts%2Fsecurity%2F",
                follow_redirects=False,
            )

        self.assertEqual(response.status_code, 302)
        self.assertTrue(
            response.headers["location"].startswith("https://accounts.google.com/o/oauth2/v2/auth?")
        )
        cookie = response.headers["set-cookie"]
        self.assertIn(f"{OAUTH_CONTEXT_COOKIE}=", cookie)
        self.assertIn("HttpOnly", cookie)
        self.assertIn("SameSite=lax", cookie)
        self.assertIn("Secure", cookie)

    def test_callback_sets_session_cookies_and_deletes_context(self) -> None:
        signed_context, state, _ = create_oauth_context("google", "/accounts/security/")
        completed = SimpleNamespace(
            next_url="/accounts/security/",
            tokens=TokenResponse(access_token="access", refresh_token="refresh", expires_in=1800),
        )
        with (
            patch("app.routers.google_auth.settings.google_enabled", True),
            patch("app.routers.google_auth.settings.google_client_id", "client"),
            patch("app.routers.google_auth.settings.google_client_secret", "secret"),
            patch("app.routers.google_auth.settings.external_auth_cookie_secure", True),
            patch("app.routers.google_auth.complete_external_auth", new=AsyncMock(return_value=completed)),
        ):
            self.client.cookies.set(OAUTH_CONTEXT_COOKIE, signed_context, path="/api/v1/auth/google/callback")
            response = self.client.get(
                f"/api/v1/auth/google/callback?code=code&state={state}",
                follow_redirects=False,
            )

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["location"], "/accounts/security/")
        cookies = response.headers.get_list("set-cookie")
        self.assertTrue(any("mini_auth_access_token=access" in value and "HttpOnly" in value for value in cookies))
        self.assertTrue(any("mini_auth_refresh_token=refresh" in value and "HttpOnly" in value for value in cookies))
        self.assertTrue(any(f"{OAUTH_CONTEXT_COOKIE}=" in value and "Max-Age=0" in value for value in cookies))

    def test_disabled_provider_returns_stable_error(self) -> None:
        with patch("app.routers.google_auth.settings.google_enabled", False):
            response = self.client.get("/api/v1/auth/google/start", follow_redirects=False)
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["detail"], "provider_disabled")

    def test_denied_callback_preserves_safe_next_for_email_fallback(self) -> None:
        signed, state, _ = create_oauth_context("google", "/oauth/authorize?client_id=minibot")
        with (
            patch("app.routers.google_auth.settings.google_enabled", True),
            patch("app.routers.google_auth.settings.google_client_id", "client"),
            patch("app.routers.google_auth.settings.google_client_secret", "secret"),
        ):
            self.client.cookies.set(OAUTH_CONTEXT_COOKIE, signed, path="/api/v1/auth/google/callback")
            response = self.client.get(
                f"/api/v1/auth/google/callback?error=access_denied&state={state}",
                follow_redirects=False,
            )

        self.assertEqual(
            response.headers["location"],
            "/login?oauth_error=oauth_callback_denied&next=%2Foauth%2Fauthorize%3Fclient_id%3Dminibot",
        )

    def test_callback_cleans_context_when_provider_becomes_disabled(self) -> None:
        signed, state, _ = create_oauth_context("google", "/accounts/security/")
        self.client.cookies.set(OAUTH_CONTEXT_COOKIE, signed, path="/api/v1/auth/google/callback")
        with patch("app.routers.google_auth.settings.google_enabled", False):
            response = self.client.get(
                f"/api/v1/auth/google/callback?code=code&state={state}",
                follow_redirects=False,
            )

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["location"], "/login?oauth_error=provider_disabled")
        self.assertTrue(
            any(
                f"{OAUTH_CONTEXT_COOKIE}=" in value and "Max-Age=0" in value
                for value in response.headers.get_list("set-cookie")
            )
        )


if __name__ == "__main__":
    unittest.main()
