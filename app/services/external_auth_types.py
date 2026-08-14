from dataclasses import dataclass
from typing import Protocol


class ExternalAuthError(Exception):
    def __init__(self, code: str, status_code: int = 400) -> None:
        self.code = code
        self.status_code = status_code
        super().__init__(code)


@dataclass(frozen=True)
class ProviderIdentity:
    provider: str
    subject: str
    union_id: str | None = None
    email: str | None = None
    email_verified: bool | None = None
    display_name: str | None = None
    avatar_url: str | None = None


@dataclass(frozen=True)
class OAuthState:
    provider: str
    state: str
    code_verifier: str
    next_url: str


@dataclass(frozen=True)
class OAuthStartContext:
    state: str
    code_challenge: str


@dataclass(frozen=True)
class OAuthCallbackContext:
    code: str
    code_verifier: str


class ExternalAuthProvider(Protocol):
    name: str
    supports_pkce: bool

    def build_authorization_url(self, context: OAuthStartContext) -> str: ...

    async def exchange_identity(self, callback: OAuthCallbackContext) -> ProviderIdentity: ...
