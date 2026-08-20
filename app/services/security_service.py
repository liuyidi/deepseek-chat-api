import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import AuthClient, AuthSession, RefreshToken, User
from app.schemas.security import (
    AuthorizedApplicationOut,
    SecurityDeviceOut,
    SecurityOperationOut,
    SecurityOverviewOut,
    SecuritySettingOut,
    SecuritySnapshotOut,
    SecurityUserOut,
)


class SecurityError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400) -> None:
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


_CLIENT_LABELS: dict[str, tuple[str, str, str]] = {
    "minibot": ("Minibot", "Web", "browser"),
    "minikb": ("MiniKB", "Web", "browser"),
    "mini-auth": ("Mini Auth", "Web", "browser"),
}

_PROVIDER_LABELS = {
    "github": "GitHub",
    "google": "Google",
    "wechat": "微信",
}


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _format_timestamp(value: datetime | None) -> str:
    if value is None:
        return "-"
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(UTC).strftime("%Y/%m/%d %H:%M:%S")


def _avatar_initials(nickname: str) -> str:
    stripped = nickname.strip()
    if not stripped:
        return "MA"
    parts = stripped.split()
    if len(parts) >= 2:
        return f"{parts[0][0]}{parts[1][0]}".upper()
    if len(stripped) >= 2:
        return stripped[:2].upper()
    return stripped[:1].upper()


def _device_from_session(session: AuthSession, *, is_current: bool) -> SecurityDeviceOut:
    client_id = (session.client_id or "").strip().lower()
    label = _CLIENT_LABELS.get(client_id)
    if label is None:
        if client_id:
            name, system, kind = client_id, "Web", "browser"
        else:
            name, system, kind = "Web 浏览器", "Web", "browser"
    else:
        name, system, kind = label

    return SecurityDeviceOut(
        id=str(session.id),
        name=name,
        system=system,
        logged_in_at=_format_timestamp(session.last_seen_at or session.created_at),
        kind=kind,  # type: ignore[arg-type]
        is_current=is_current,
    )


def _identity_summary(user: User) -> str:
    providers = sorted(
        {
            _PROVIDER_LABELS.get(identity.provider, identity.provider)
            for identity in (user.identities or [])
        }
    )
    if not providers:
        return "管理用于登录 Mini Auth 和身份验证的手机号码与邮箱等"
    joined = "、".join(providers)
    return f"已绑定 {joined}。管理用于登录 Mini Auth 和身份验证的手机号码与邮箱等"


def _build_settings(user: User) -> list[SecuritySettingOut]:
    has_identities = bool(user.identities)
    login_methods_set = bool(user.email or user.phone or has_identities)
    login_password_set = not has_identities

    return [
        SecuritySettingOut(
            id="two-factor",
            title="两步验证",
            description="启用后，登录 Mini Auth 时需完成身份和密码的双重验证，确保账号安全",
            status="unset",
            icon="shield",
            tone="blue",
        ),
        SecuritySettingOut(
            id="login-methods",
            title="登录方式",
            description=_identity_summary(user),
            status="set" if login_methods_set else "unset",
            icon="user-settings",
            tone="blue",
        ),
        SecuritySettingOut(
            id="login-password",
            title="登录密码",
            description="设置登录 Mini Auth 的密码",
            status="set" if login_password_set else "unset",
            icon="password",
            tone="orange",
        ),
        SecuritySettingOut(
            id="passkey",
            title="通行密钥",
            description="可通过设备指纹、面容识别等方式快速进行身份验证",
            status="unset",
            icon="passkey",
            tone="violet",
        ),
        SecuritySettingOut(
            id="otp",
            title="动态口令",
            description="OTP 动态口令可用于完成身份验证",
            status="unset",
            icon="otp",
            tone="violet",
        ),
        SecuritySettingOut(
            id="backup-verification",
            title="备用验证方式",
            description="设置后，可使用备用手机号或邮箱进行身份验证",
            status="unset",
            icon="backup",
            tone="blue",
        ),
        SecuritySettingOut(
            id="secure-password",
            title="安全密码",
            description="查看敏感信息时，需要输入安全密码进行验证，确保信息安全",
            status="unset",
            icon="secure-password",
            tone="teal",
        ),
    ]


def _build_overview(settings: list[SecuritySettingOut]) -> SecurityOverviewOut:
    unset_count = sum(1 for setting in settings if setting.status == "unset")
    set_count = len(settings) - unset_count
    score = min(100, 45 + set_count * 9)
    if score >= 80:
        level = "高"
    elif score >= 60:
        level = "中"
    else:
        level = "低"
    return SecurityOverviewOut(
        score=score,
        level=level,  # type: ignore[arg-type]
        optimizable_items=unset_count,
        two_factor_enabled=False,
    )


async def _load_active_sessions(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> list[AuthSession]:
    now = _utcnow()
    result = await db.execute(
        select(AuthSession)
        .where(
            AuthSession.user_id == user_id,
            AuthSession.revoked_at.is_(None),
            AuthSession.expires_at > now,
        )
        .order_by(AuthSession.last_seen_at.desc().nullslast(), AuthSession.created_at.desc())
    )
    return list(result.scalars().all())


async def build_security_snapshot(
    db: AsyncSession,
    user: User,
    *,
    current_session_id: uuid.UUID | None,
) -> SecuritySnapshotOut:
    sessions = await _load_active_sessions(db, user.id)
    settings = _build_settings(user)
    overview = _build_overview(settings)
    return SecuritySnapshotOut(
        user=SecurityUserOut(
            nickname=user.nickname,
            email=user.email,
            avatar_initials=_avatar_initials(user.nickname),
        ),
        overview=overview,
        devices=[
            _device_from_session(session, is_current=session.id == current_session_id)
            for session in sessions
        ],
        settings=settings,
    )


async def list_security_operations(
    _db: AsyncSession,
    _user: User,
) -> list[SecurityOperationOut]:
    return []


async def list_authorized_applications(
    db: AsyncSession,
    user: User,
) -> list[AuthorizedApplicationOut]:
    sessions = await _load_active_sessions(db, user.id)
    seen: set[str] = set()
    applications: list[AuthorizedApplicationOut] = []

    for session in sessions:
        client_id = (session.client_id or "").strip()
        if not client_id or client_id in seen:
            continue
        seen.add(client_id)
        client_result = await db.execute(select(AuthClient).where(AuthClient.client_id == client_id))
        client = client_result.scalar_one_or_none()
        name = client.name if client is not None else _CLIENT_LABELS.get(client_id.lower(), (client_id, "", ""))[0]
        applications.append(
            AuthorizedApplicationOut(
                id=client_id,
                name=name,
                description="访问你的基础账号信息和邮箱地址",
                authorized_at=_format_timestamp(session.created_at)[:10].replace("-", "/"),
            )
        )
    return applications


async def revoke_security_session(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    session_id: uuid.UUID,
    current_session_id: uuid.UUID | None,
) -> None:
    if current_session_id is not None and session_id == current_session_id:
        raise SecurityError("current_device", "Cannot revoke the current session", status_code=409)

    result = await db.execute(
        select(AuthSession).where(
            AuthSession.id == session_id,
            AuthSession.user_id == user_id,
            AuthSession.revoked_at.is_(None),
        )
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise SecurityError("not_found", "Session not found", status_code=404)

    now = _utcnow()
    session.revoked_at = now
    session.last_seen_at = now

    token_result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.session_id == session.id,
            RefreshToken.revoked_at.is_(None),
        )
    )
    for token in token_result.scalars().all():
        token.revoked_at = now

    await db.commit()
