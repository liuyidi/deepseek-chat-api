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


class GoogleAuthProvider:
    name = "google"
    supports_pkce = True

    def __init__(
        self,
        client_id: str | None = None,
        client_secret: str | None = None,
        redirect_uri: str | None = None,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.client_id = client_id if client_id is not None else settings.google_client_id
        self.client_secret = client_secret if client_secret is not None else settings.google_client_secret
        self.redirect_uri = redirect_uri if redirect_uri is not None else settings.google_redirect_uri
        self.client = client

    def build_authorization_url(self, context: OAuthStartContext) -> str:
        query = urlencode(
            {
                "client_id": self.client_id,
                "redirect_uri": self.redirect_uri,
                "response_type": "code",
                "scope": "openid email profile",
                "state": context.state,
                "code_challenge": context.code_challenge,
                "code_challenge_method": "S256",
                "access_type": "online",
                "prompt": "select_account",
            }
        )
        return f"https://accounts.google.com/o/oauth2/v2/auth?{query}"

    async def exchange_identity(self, callback: OAuthCallbackContext) -> ProviderIdentity:
        owns_client = self.client is None
        client = self.client or httpx.AsyncClient(timeout=settings.google_http_timeout_seconds)
        try:
            token_response = await client.post(
                "https://oauth2.googleapis.com/token",
                headers={"Accept": "application/json", "User-Agent": "mini-auth"},
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code": callback.code,
                    "redirect_uri": self.redirect_uri,
                    "grant_type": "authorization_code",
                    "code_verifier": callback.code_verifier,
                },
            )
            token_response.raise_for_status()
            token_payload = token_response.json()
            access_token = token_payload.get("access_token")
            if not isinstance(access_token, str) or not access_token:
                logger.warning(
                    "Google token exchange returned no access token: status=%s payload_keys=%s error=%s",
                    token_response.status_code,
                    sorted(token_payload.keys()) if isinstance(token_payload, dict) else type(token_payload).__name__,
                    token_payload.get("error") if isinstance(token_payload, dict) else None,
                )
                raise ExternalAuthError("provider_exchange_failed", status_code=502)
            profile_response = await client.get(
                "https://openidconnect.googleapis.com/v1/userinfo",
                headers={
                    "Accept": "application/json",
                    "Authorization": f"Bearer {access_token}",
                    "User-Agent": "mini-auth",
                },
            )
            profile_response.raise_for_status()
            profile = profile_response.json()
        except ExternalAuthError:
            raise
        except (httpx.HTTPError, ValueError, AttributeError) as exc:
            logger.warning("Google token exchange failed: %s", exc.__class__.__name__, exc_info=True)
            raise ExternalAuthError("provider_exchange_failed", status_code=502) from exc
        finally:
            if owns_client:
                await client.aclose()

        if not isinstance(profile, dict):
            raise ExternalAuthError("provider_identity_invalid", status_code=502)

        subject = profile.get("sub")
        email = profile.get("email")
        email_verified = profile.get("email_verified")
        if not isinstance(subject, str) or not subject:
            raise ExternalAuthError("provider_identity_invalid", status_code=502)
        if email_verified is not True or not isinstance(email, str) or not email.strip():
            raise ExternalAuthError("verified_email_required", status_code=422)

        name = profile.get("name")
        picture = profile.get("picture")
        return ProviderIdentity(
            provider=self.name,
            subject=subject,
            email=email.strip().lower(),
            email_verified=True,
            display_name=name.strip() if isinstance(name, str) and name.strip() else None,
            avatar_url=picture if isinstance(picture, str) else None,
        )
