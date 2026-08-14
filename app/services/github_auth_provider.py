from urllib.parse import urlencode

import httpx
import logging

from app.config import settings
from app.services.external_auth_types import (
    ExternalAuthError,
    OAuthCallbackContext,
    OAuthStartContext,
    ProviderIdentity,
)


logger = logging.getLogger(__name__)


class GitHubAuthProvider:
    name = "github"
    supports_pkce = True

    def __init__(
        self,
        client_id: str | None = None,
        client_secret: str | None = None,
        redirect_uri: str | None = None,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.client_id = client_id if client_id is not None else settings.github_client_id
        self.client_secret = client_secret if client_secret is not None else settings.github_client_secret
        self.redirect_uri = redirect_uri if redirect_uri is not None else settings.github_redirect_uri
        self.client = client

    def build_authorization_url(self, context: OAuthStartContext) -> str:
        query = urlencode(
            {
                "client_id": self.client_id,
                "redirect_uri": self.redirect_uri,
                "scope": "read:user user:email",
                "state": context.state,
                "code_challenge": context.code_challenge,
                "code_challenge_method": "S256",
            }
        )
        return f"https://github.com/login/oauth/authorize?{query}"

    async def exchange_identity(self, callback: OAuthCallbackContext) -> ProviderIdentity:
        owns_client = self.client is None
        client = self.client or httpx.AsyncClient(timeout=settings.github_http_timeout_seconds)
        headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "mini-auth",
        }
        try:
            token_response = await client.post(
                "https://github.com/login/oauth/access_token",
                headers={"Accept": "application/json", "User-Agent": "mini-auth"},
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code": callback.code,
                    "redirect_uri": self.redirect_uri,
                    "code_verifier": callback.code_verifier,
                },
            )
            token_response.raise_for_status()
            token_payload = token_response.json()
            access_token = token_payload.get("access_token")
            if not isinstance(access_token, str) or not access_token:
                logger.warning(
                    "GitHub token exchange returned no access token: status=%s payload_keys=%s error=%s",
                    token_response.status_code,
                    sorted(token_payload.keys()) if isinstance(token_payload, dict) else type(token_payload).__name__,
                    token_payload.get("error") if isinstance(token_payload, dict) else None,
                )
                raise ExternalAuthError("provider_exchange_failed", status_code=502)
            auth_headers = {**headers, "Authorization": f"Bearer {access_token}"}
            profile_response = await client.get("https://api.github.com/user", headers=auth_headers)
            emails_response = await client.get("https://api.github.com/user/emails", headers=auth_headers)
            profile_response.raise_for_status()
            emails_response.raise_for_status()
            profile = profile_response.json()
            emails = emails_response.json()
        except ExternalAuthError:
            raise
        except (httpx.HTTPError, ValueError, AttributeError) as exc:
            logger.warning("GitHub token exchange failed: %s", exc.__class__.__name__, exc_info=True)
            raise ExternalAuthError("provider_exchange_failed", status_code=502) from exc
        finally:
            if owns_client:
                await client.aclose()

        subject = profile.get("id") if isinstance(profile, dict) else None
        login = profile.get("login") if isinstance(profile, dict) else None
        if not isinstance(subject, int) or not isinstance(login, str) or not login:
            raise ExternalAuthError("provider_identity_invalid", status_code=502)
        primary = next(
            (
                item
                for item in emails
                if isinstance(item, dict)
                and item.get("primary") is True
                and item.get("verified") is True
                and isinstance(item.get("email"), str)
            ),
            None,
        ) if isinstance(emails, list) else None
        if primary is None:
            raise ExternalAuthError("verified_email_required", status_code=422)
        name = profile.get("name")
        avatar = profile.get("avatar_url")
        return ProviderIdentity(
            provider=self.name,
            subject=str(subject),
            email=primary["email"].strip().lower(),
            email_verified=True,
            display_name=name.strip() if isinstance(name, str) and name.strip() else login,
            avatar_url=avatar if isinstance(avatar, str) else None,
        )
