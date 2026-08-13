from pydantic import BaseModel, EmailStr, Field

from app.schemas.auth import AuthResponse


class EmailCodeStartRequest(BaseModel):
    email: EmailStr


class EmailCodeStartResponse(BaseModel):
    email: EmailStr
    expires_in: int
    resend_after_seconds: int
    debug_code: str | None = None


class EmailCodeVerifyRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=4, max_length=12)


class EmailCodeVerifyResponse(AuthResponse):
    pass
