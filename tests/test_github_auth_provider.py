import unittest
from urllib.parse import parse_qs, urlsplit

import httpx

from app.services.external_auth_types import ExternalAuthError, OAuthCallbackContext, OAuthStartContext
from app.services.github_auth_provider import GitHubAuthProvider


class GitHubAuthProviderTest(unittest.IsolatedAsyncioTestCase):
    def test_authorization_url_uses_minimal_scopes_and_pkce(self) -> None:
        provider = GitHubAuthProvider(client_id="client", client_secret="secret", redirect_uri="https://auth.example/callback")

        query = parse_qs(urlsplit(provider.build_authorization_url(OAuthStartContext("state-1", "challenge-1"))).query)

        self.assertEqual(query["scope"], ["read:user user:email"])
        self.assertEqual(query["state"], ["state-1"])
        self.assertEqual(query["code_challenge"], ["challenge-1"])
        self.assertEqual(query["code_challenge_method"], ["S256"])

    async def test_exchange_normalizes_numeric_id_and_primary_verified_email(self) -> None:
        async def handler(request: httpx.Request) -> httpx.Response:
            if request.url.path == "/login/oauth/access_token":
                self.assertIn(b"code_verifier=verifier", request.content)
                return httpx.Response(200, json={"access_token": "provider-token", "token_type": "bearer"})
            if request.url.path == "/user":
                return httpx.Response(200, json={"id": 12345, "login": "octo", "name": None, "avatar_url": "https://avatar/1"})
            return httpx.Response(200, json=[
                {"email": "other@example.com", "primary": False, "verified": True},
                {"email": "Main@Example.com", "primary": True, "verified": True},
            ])

        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            identity = await GitHubAuthProvider("client", "secret", "https://auth.example/callback", client).exchange_identity(
                OAuthCallbackContext("code-1", "verifier")
            )

        self.assertEqual(identity.subject, "12345")
        self.assertEqual(identity.email, "main@example.com")
        self.assertTrue(identity.email_verified)
        self.assertEqual(identity.display_name, "octo")

    async def test_exchange_requires_primary_verified_email(self) -> None:
        async def handler(request: httpx.Request) -> httpx.Response:
            if request.url.path == "/login/oauth/access_token":
                return httpx.Response(200, json={"access_token": "token"})
            if request.url.path == "/user":
                return httpx.Response(200, json={"id": 1, "login": "octo", "name": "Octo", "avatar_url": None})
            return httpx.Response(200, json=[{"email": "hidden@example.com", "primary": True, "verified": False}])

        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            with self.assertRaises(ExternalAuthError) as caught:
                await GitHubAuthProvider("client", "secret", "https://auth.example/callback", client).exchange_identity(
                    OAuthCallbackContext("code", "verifier")
                )
        self.assertEqual(caught.exception.code, "verified_email_required")

    async def test_exchange_maps_upstream_failure_without_response_body(self) -> None:
        async def handler(_: httpx.Request) -> httpx.Response:
            return httpx.Response(401, text="secret upstream details")

        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            with self.assertRaises(ExternalAuthError) as caught:
                await GitHubAuthProvider("client", "secret", "https://auth.example/callback", client).exchange_identity(
                    OAuthCallbackContext("bad", "verifier")
                )
        self.assertEqual(caught.exception.code, "provider_exchange_failed")
        self.assertNotIn("secret upstream", str(caught.exception))


if __name__ == "__main__":
    unittest.main()
