from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.schemas.auth import TokenResponse
from app.services.auth_service import issue_tokens
from app.services.external_auth_state import create_oauth_context, decode_oauth_context, normalize_return_url
from app.services.external_auth_types import (
    ExternalAuthProvider,
    OAuthCallbackContext,
    OAuthStartContext,
)
from app.services.external_identity_service import resolve_external_identity


@dataclass(frozen=True)
class ExternalAuthStart:
    authorization_url: str
    signed_context: str
    state: str


@dataclass(frozen=True)
class ExternalAuthResult:
    user: User
    tokens: TokenResponse
    next_url: str


def start_external_auth(provider: ExternalAuthProvider, next_url: str) -> ExternalAuthStart:
    signed_context, state, challenge = create_oauth_context(provider.name, normalize_return_url(next_url))
    authorization_url = provider.build_authorization_url(OAuthStartContext(state, challenge))
    return ExternalAuthStart(authorization_url, signed_context, state)


async def complete_external_auth(
    db: AsyncSession,
    provider: ExternalAuthProvider,
    code: str,
    state: str,
    signed_context: str,
) -> ExternalAuthResult:
    context = decode_oauth_context(signed_context, provider.name, state)
    identity = await provider.exchange_identity(OAuthCallbackContext(code, context.code_verifier))
    user = await resolve_external_identity(db, identity)
    tokens = await issue_tokens(db, user)
    return ExternalAuthResult(user, tokens, context.next_url)
