import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from app.schemas.auth import TokenResponse
from app.services.external_auth_flow_service import complete_external_auth, start_external_auth
from app.services.external_auth_types import ProviderIdentity


class FakeProvider:
    name = "github"
    supports_pkce = True

    def build_authorization_url(self, context):
        return f"https://provider.example/auth?state={context.state}&challenge={context.code_challenge}"

    async def exchange_identity(self, callback):
        self.callback = callback
        return ProviderIdentity("github", "123", email="person@example.com", email_verified=True)


class ExternalAuthFlowServiceTest(unittest.IsolatedAsyncioTestCase):
    async def test_start_and_complete_share_signed_pkce_context(self) -> None:
        provider = FakeProvider()
        started = start_external_auth(provider, "/accounts/security/")
        user = SimpleNamespace(id="user")
        tokens = TokenResponse(access_token="access", refresh_token="refresh", expires_in=1800)

        with (
            patch("app.services.external_auth_flow_service.resolve_external_identity", new=AsyncMock(return_value=user)),
            patch("app.services.external_auth_flow_service.issue_tokens", new=AsyncMock(return_value=tokens)),
        ):
            completed = await complete_external_auth(
                MagicMock(), provider, "code-1", started.state, started.signed_context
            )

        self.assertEqual(completed.next_url, "/accounts/security/")
        self.assertIs(completed.user, user)
        self.assertEqual(completed.tokens.access_token, "access")
        self.assertEqual(provider.callback.code, "code-1")
        self.assertGreaterEqual(len(provider.callback.code_verifier), 43)


if __name__ == "__main__":
    unittest.main()
