from typing import Literal

from pydantic import BaseModel, Field


SecuritySettingStatus = Literal["set", "unset"]
SecurityLevel = Literal["低", "中", "高"]
SecurityDeviceKind = Literal["browser", "desktop", "mobile"]
SecurityIconName = Literal[
    "shield",
    "user-settings",
    "password",
    "passkey",
    "otp",
    "backup",
    "secure-password",
]
SecurityIconTone = Literal["blue", "orange", "violet", "teal"]


class SecurityUserOut(BaseModel):
    nickname: str
    email: str
    avatar_initials: str
    avatar_url: str | None = None


class SecurityOverviewOut(BaseModel):
    score: int
    level: SecurityLevel
    optimizable_items: int
    two_factor_enabled: bool


class SecurityDeviceOut(BaseModel):
    id: str
    name: str
    system: str
    logged_in_at: str
    last_seen_at: str
    kind: SecurityDeviceKind
    is_current: bool
    client_id: str | None = None
    app_name: str | None = None
    ip_address: str | None = None
    location: str | None = None


class SecuritySettingOut(BaseModel):
    id: str
    title: str
    description: str
    status: SecuritySettingStatus
    icon: SecurityIconName
    tone: SecurityIconTone
    toggle: bool | None = None


class SecuritySnapshotOut(BaseModel):
    user: SecurityUserOut
    overview: SecurityOverviewOut
    devices: list[SecurityDeviceOut] = Field(default_factory=list)
    settings: list[SecuritySettingOut] = Field(default_factory=list)


class SecurityOperationOut(BaseModel):
    id: str
    action: str
    device: str
    occurred_at: str
    location: str
    kind: SecurityDeviceKind | None = None
    app_name: str | None = None
    ip_address: str | None = None
    ip_masked: str | None = None
    status: str | None = None


class AuthorizedApplicationOut(BaseModel):
    id: str
    name: str
    description: str
    authorized_at: str
    scopes: str | None = None
