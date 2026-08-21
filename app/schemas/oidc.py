from pydantic import BaseModel, Field

DEVICE_CODE_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code"
DEVICE_CODE_GRANT_TYPES = frozenset({"device_code", DEVICE_CODE_GRANT_TYPE})
TOKEN_GRANT_TYPE_PATTERN = (
    rf"^(authorization_code|refresh_token|device_code|{DEVICE_CODE_GRANT_TYPE})$"
)


class OidcTokenRequest(BaseModel):
    grant_type: str = Field(pattern=TOKEN_GRANT_TYPE_PATTERN)
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


class DeviceRequestSnapshot(BaseModel):
    user_code: str
    client_id: str
    scope: str
    verification_uri: str
    device_label: str
    location: str | None = None
    created_at: str
    ip_address: str | None = None
    user_agent: str | None = None
    status: str
    approved_user: str | None = None
    approved_at: str | None = None


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
