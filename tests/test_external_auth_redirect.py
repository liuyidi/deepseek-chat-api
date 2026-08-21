import unittest

from app.schemas.auth import TokenResponse
from app.services.external_auth_redirect import (
    build_native_oauth_redirect,
    is_native_app_callback,
    resolve_native_redirect_uri,
)


class ExternalAuthRedirectTest(unittest.TestCase):
    def test_detects_native_callback_path(self) -> None:
        self.assertTrue(is_native_app_callback("/oauth/app-callback"))
        self.assertTrue(
            is_native_app_callback("/oauth/app-callback?redirect_uri=minibot%3A%2F%2Foauth")
        )
        self.assertFalse(is_native_app_callback("/accounts/security/"))

    def test_resolve_redirect_uri_allowlist(self) -> None:
        self.assertEqual(
            resolve_native_redirect_uri("/oauth/app-callback"),
            "minibot://oauth",
        )
        self.assertEqual(
            resolve_native_redirect_uri(
                "/oauth/app-callback?redirect_uri=exp%3A%2F%2F192.168.1.1%3A8081%2F--%2Foauth"
            ),
            "exp://192.168.1.1:8081/--/oauth",
        )
        self.assertIsNone(
            resolve_native_redirect_uri(
                "/oauth/app-callback?redirect_uri=https%3A%2F%2Fevil.example%2Fsteal"
            )
        )

    def test_build_native_redirect_appends_tokens(self) -> None:
        tokens = TokenResponse(access_token="a", refresh_token="r", expires_in=1800)
        response = build_native_oauth_redirect("minibot://oauth", tokens)
        self.assertEqual(response.status_code, 302)
        location = response.headers["location"]
        self.assertTrue(location.startswith("minibot://oauth?"))
        self.assertIn("access_token=a", location)
        self.assertIn("refresh_token=r", location)
        self.assertIn("expires_in=1800", location)


if __name__ == "__main__":
    unittest.main()
