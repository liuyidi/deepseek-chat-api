import unittest
from unittest.mock import patch

from app.services.external_auth_state import (
    ExternalAuthError,
    create_oauth_context,
    decode_oauth_context,
    normalize_return_url,
)


class ExternalAuthStateTest(unittest.TestCase):
    def test_accepts_relative_and_allowlisted_https_return_urls(self) -> None:
        with patch("app.services.external_auth_state.settings.external_auth_allowed_return_origins", "https://bot.liuyidi.me"):
            self.assertEqual(normalize_return_url("/oauth/authorize?client_id=minibot"), "/oauth/authorize?client_id=minibot")
            self.assertEqual(normalize_return_url("https://bot.liuyidi.me/chat"), "https://bot.liuyidi.me/chat")

    def test_rejects_unsafe_return_urls(self) -> None:
        with patch("app.services.external_auth_state.settings.external_auth_allowed_return_origins", "https://bot.liuyidi.me"):
            for value in ("//evil.example/path", "http://bot.liuyidi.me/", "https://evil.example/", "https://bot.liuyidi.me/#token"):
                with self.subTest(value=value), self.assertRaises(ExternalAuthError) as caught:
                    normalize_return_url(value)
                self.assertEqual(caught.exception.code, "invalid_return_url")

    def test_rejects_malformed_absolute_return_urls(self) -> None:
        for value in ("https://auth.liuyidi.me:notaport/", "https://[broken/"):
            with self.subTest(value=value), self.assertRaises(ExternalAuthError) as caught:
                normalize_return_url(value)
            self.assertEqual(caught.exception.code, "invalid_return_url")

    def test_signed_context_round_trips_and_contains_pkce(self) -> None:
        token, state, challenge = create_oauth_context("github", "/accounts/security/")

        context = decode_oauth_context(token, "github", state)

        self.assertEqual(context.provider, "github")
        self.assertEqual(context.next_url, "/accounts/security/")
        self.assertGreaterEqual(len(context.code_verifier), 43)
        self.assertGreaterEqual(len(challenge), 43)
        self.assertNotEqual(challenge, context.code_verifier)

    def test_rejects_provider_or_state_mismatch(self) -> None:
        token, state, _ = create_oauth_context("github", "/")

        with self.assertRaises(ExternalAuthError) as provider_error:
            decode_oauth_context(token, "google", state)
        self.assertEqual(provider_error.exception.code, "oauth_state_invalid")

        with self.assertRaises(ExternalAuthError) as state_error:
            decode_oauth_context(token, "github", "wrong-state")
        self.assertEqual(state_error.exception.code, "oauth_state_invalid")

        with self.assertRaises(ExternalAuthError) as unicode_error:
            decode_oauth_context(token, "github", "状态")
        self.assertEqual(unicode_error.exception.code, "oauth_state_invalid")


if __name__ == "__main__":
    unittest.main()
