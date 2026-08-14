from pydantic import BaseModel, Field


class OidcTokenRequest(BaseModel):
    grant_type: str = Field(pattern="^authorization_code$")
    code: str
    redirect_uri: str
    client_id: str
    code_verifier: str


class OidcIdentity(BaseModel):
    provider: str
    display_name: str | None = None


class OidcUserInfo(BaseModel):
    sub: str
    email: str | None = None
    email_verified: bool | None = None
    preferred_username: str | None = None
    name: str | None = None
    picture: str | None = None
    phone_number: str | None = None
    identities: list[OidcIdentity] = Field(default_factory=list)
