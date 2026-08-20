import unittest
from urllib.parse import parse_qs, urlsplit

import httpx

from app.services.external_auth_types import ExternalAuthError, OAuthCallbackContext, OAuthStartContext
from app.services.google_auth_provider import GoogleAuthProvider


class GoogleAuthProviderTest(unittest.IsolatedAsyncioTestCase):
    def test_authorization_url_uses_openid_scopes_and_pkce(self) -> None:
        provider = GoogleAuthProvider(
            client_id="client",
            client_secret="secret",
            redirect_uri="https://auth.example/callback",
        )

        query = parse_qs(
            urlsplit(provider.build_authorization_url(OAuthStartContext("state-1", "challenge-1"))).query
        )

        self.assertEqual(query["scope"], ["openid email profile"])
        self.assertEqual(query["response_type"], ["code"])
        self.assertEqual(query["state"], ["state-1"])
        self.assertEqual(query["code_challenge"], ["challenge-1"])
        self.assertEqual(query["code_challenge_method"], ["S256"])

    async def test_exchange_normalizes_sub_and_verified_email(self) -> None:
        async def handler(request: httpx.Request) -> httpx.Response:
            if request.url.host == "oauth2.googleapis.com":
                self.assertIn(b"code_verifier=verifier", request.content)
                self.assertIn(b"grant_type=authorization_code", request.content)
                return httpx.Response(200, json={"access_token": "provider-token", "token_type": "Bearer"})
            return httpx.Response(
                200,
                json={
                    "sub": "google-subject-123",
                    "email": "Main@Example.com",
                    "email_verified": True,
                    "name": "Mini User",
                    "picture": "https://avatar/1",
                },
            )

        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            identity = await GoogleAuthProvider(
                "client",
                "secret",
                "https://auth.example/callback",
                client,
            ).exchange_identity(OAuthCallbackContext("code-1", "verifier"))

        self.assertEqual(identity.provider, "google")
        self.assertEqual(identity.subject, "google-subject-123")
        self.assertEqual(identity.email, "main@example.com")
        self.assertTrue(identity.email_verified)
        self.assertEqual(identity.display_name, "Mini User")
        self.assertEqual(identity.avatar_url, "https://avatar/1")

    async def test_exchange_requires_verified_email(self) -> None:
        async def handler(request: httpx.Request) -> httpx.Response:
            if request.url.host == "oauth2.googleapis.com":
                return httpx.Response(200, json={"access_token": "token"})
            return httpx.Response(
                200,
                json={
                    "sub": "google-subject-123",
                    "email": "hidden@example.com",
                    "email_verified": False,
                    "name": "Mini User",
                },
            )

        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            with self.assertRaises(ExternalAuthError) as caught:
                await GoogleAuthProvider(
                    "client",
                    "secret",
                    "https://auth.example/callback",
                    client,
                ).exchange_identity(OAuthCallbackContext("code", "verifier"))
        self.assertEqual(caught.exception.code, "verified_email_required")

    async def test_exchange_maps_upstream_failure_without_response_body(self) -> None:
        async def handler(_: httpx.Request) -> httpx.Response:
            return httpx.Response(401, text="secret upstream details")

        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            with self.assertRaises(ExternalAuthError) as caught:
                await GoogleAuthProvider(
                    "client",
                    "secret",
                    "https://auth.example/callback",
                    client,
                ).exchange_identity(OAuthCallbackContext("bad", "verifier"))
        self.assertEqual(caught.exception.code, "provider_exchange_failed")
        self.assertNotIn("secret upstream", str(caught.exception))

    async def test_exchange_uses_relay_when_configured(self) -> None:
        async def handler(request: httpx.Request) -> httpx.Response:
            self.assertEqual(request.url.host, "relay.example")
            self.assertEqual(request.headers.get("authorization"), "Bearer relay-secret")
            self.assertIn(b'"code":"code-1"', request.content)
            self.assertIn(b'"code_verifier":"verifier"', request.content)
            return httpx.Response(
                200,
                json={
                    "sub": "google-subject-456",
                    "email": "relay@example.com",
                    "email_verified": True,
                    "name": "Relay User",
                },
            )

        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            identity = await GoogleAuthProvider(
                "client",
                "secret",
                "https://auth.example/callback",
                client,
                relay_url="https://relay.example/api/google/exchange",
                relay_shared_secret="relay-secret",
            ).exchange_identity(OAuthCallbackContext("code-1", "verifier"))

        self.assertEqual(identity.subject, "google-subject-456")
        self.assertEqual(identity.email, "relay@example.com")

    async def test_relay_maps_verified_email_error(self) -> None:
        async def handler(_: httpx.Request) -> httpx.Response:
            return httpx.Response(422, json={"error": "verified_email_required"})

        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            with self.assertRaises(ExternalAuthError) as caught:
                await GoogleAuthProvider(
                    "client",
                    "secret",
                    "https://auth.example/callback",
                    client,
                    relay_url="https://relay.example/api/google/exchange",
                    relay_shared_secret="relay-secret",
                ).exchange_identity(OAuthCallbackContext("code", "verifier"))
        self.assertEqual(caught.exception.code, "verified_email_required")

    async def test_relay_maps_upstream_failure(self) -> None:
        async def handler(_: httpx.Request) -> httpx.Response:
            return httpx.Response(502, json={"error": "provider_exchange_failed"})

        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            with self.assertRaises(ExternalAuthError) as caught:
                await GoogleAuthProvider(
                    "client",
                    "secret",
                    "https://auth.example/callback",
                    client,
                    relay_url="https://relay.example/api/google/exchange",
                    relay_shared_secret="relay-secret",
                ).exchange_identity(OAuthCallbackContext("code", "verifier"))
        self.assertEqual(caught.exception.code, "provider_exchange_failed")


if __name__ == "__main__":
    unittest.main()
