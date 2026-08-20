from pydantic import BaseModel, Field


class OidcTokenRequest(BaseModel):
    grant_type: str = Field(pattern="^(authorization_code|refresh_token|device_code)$")
    code: str | None = None
    redirect_uri: str | None = None
    client_id: str
    code_verifier: str | None = None
    refresh_token: str | None = None
    device_code: str | None = None


class DeviceStartRequest(BaseModel):
    client_id: str
    scope: str = "openid profile email"


class DeviceStartResponse(BaseModel):
    device_code: str
    user_code: str
    verification_uri: str
    verification_uri_complete: str
    expires_in: int
    interval: int


class DeviceConfirmRequest(BaseModel):
    user_code: str
    approve: bool = True


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
