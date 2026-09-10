import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import AuditLog, AuthSession, RefreshToken, User
from app.schemas.security import (
    AuthorizedApplicationOut,
    SecurityDeviceOut,
    SecurityOperationOut,
    SecurityOverviewOut,
    SecuritySettingOut,
    SecuritySnapshotOut,
    SecurityUserOut,
)
from app.services.audit_service import record_audit
from app.services.ip_mask import mask_ip
from app.services.consent_service import (
    ConsentError,
    list_active_consents,
    resolve_client_name,
    revoke_oauth_consent,
)
from app.services.request_context import SessionMeta, parse_user_agent


class SecurityError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400) -> None:
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


_CLIENT_LABELS: dict[str, str] = {
    "minibot": "Minibot",
    "minikb": "MiniKB",
    "mini-auth": "Mini Auth",
}

_ACTION_LABELS: dict[str, str] = {
    "login": "登录/切换账号",
    "login.register": "注册并登录",
    "login.password": "登录/切换账号",
    "login.email_code": "登录/切换账号",
    "login.demo": "登录/切换账号",
    "login.oauth.github": "登录/切换账号",
    "login.oauth.google": "登录/切换账号",
    "login.oauth.device": "登录/切换账号",
    "login.oauth.code": "登录/切换账号",
    "logout": "退出登录",
    "session.revoke": "退出登录",
    "consent.revoke": "取消应用授权",
}

# Security-center "操作记录": login / switch / logout only.
_OPERATION_RECORD_ACTIONS = frozenset(_ACTION_LABELS) - {"consent.revoke"}
_OPERATION_RECORD_LIMIT = 10
_OPERATION_RECORD_DAYS = 30

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


def _app_name_for_client(client_id: str | None) -> str | None:
    if not client_id:
        return None
    return _CLIENT_LABELS.get(client_id.lower(), client_id)


def _session_display_name(session: AuthSession) -> str:
    browser, _system, _kind = parse_user_agent(session.user_agent)
    label = (session.device_label or "").strip()
    return label or browser


def _device_from_session(session: AuthSession, *, is_current: bool) -> SecurityDeviceOut:
    _browser, system, kind = parse_user_agent(session.user_agent)
    name = _session_display_name(session)
    app_name = _app_name_for_client(session.client_id)
    return SecurityDeviceOut(
        id=str(session.id),
        name=name,
        system=system,
        logged_in_at=_format_timestamp(session.created_at),
        last_seen_at=_format_timestamp(session.last_seen_at or session.created_at),
        kind=kind,  # type: ignore[arg-type]
        is_current=is_current,
        client_id=session.client_id,
        app_name=app_name,
        ip_address=session.ip_address,
        location=session.location,
    )


def _dedupe_devices_by_name(devices: list[SecurityDeviceOut]) -> list[SecurityDeviceOut]:
    """Keep one row per device title; prefer 本机, else most recently active."""
    best_by_name: dict[str, SecurityDeviceOut] = {}
    for device in devices:
        key = device.name
        current = best_by_name.get(key)
        if current is None:
            best_by_name[key] = device
            continue
        if device.is_current and not current.is_current:
            best_by_name[key] = device

    seen: set[str] = set()
    deduped: list[SecurityDeviceOut] = []
    for device in devices:
        if device.name in seen:
            continue
        seen.add(device.name)
        deduped.append(best_by_name[device.name])
    return deduped


def _identity_summary(user: User) -> str:
    providers = sorted(
        {
            _PROVIDER_LABELS.get(identity.provider, identity.provider)
            for identity in (user.identities or [])
        }
    )
    if not providers:
        return "管理用于登录的手机号码与邮箱等"
    joined = "、".join(providers)
    return f"已绑定 {joined}。管理用于登录的手机号码与邮箱等"


def _build_settings(user: User) -> list[SecuritySettingOut]:
    has_identities = bool(user.identities)
    login_methods_set = bool(user.email or user.phone or has_identities)
    login_password_set = not has_identities

    return [
        SecuritySettingOut(
            id="two-factor",
            title="两步验证",
            description="启用后，登录时需完成身份和密码的双重验证，确保账号安全",
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
            description="设置登录密码",
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


def _scope_description(scopes: str) -> str:
    parts = [part for part in scopes.replace(",", " ").split() if part]
    labels = {
        "openid": "身份标识",
        "profile": "基础账号信息",
        "email": "邮箱地址",
        "offline_access": "离线访问",
    }
    friendly = [labels.get(part, part) for part in parts]
    if not friendly:
        return "访问你的基础账号信息"
    return "访问你的" + "、".join(friendly)


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
            avatar_url=user.avatar_url,
        ),
        overview=overview,
        devices=_dedupe_devices_by_name(
            [
                _device_from_session(session, is_current=session.id == current_session_id)
                for session in sessions
            ]
        ),
        settings=settings,
    )


async def list_security_operations(
    db: AsyncSession,
    user: User,
) -> list[SecurityOperationOut]:
    cutoff = _utcnow() - timedelta(days=_OPERATION_RECORD_DAYS)
    result = await db.execute(
        select(AuditLog)
        .where(
            AuditLog.actor_user_id == user.id,
            AuditLog.created_at >= cutoff,
            or_(
                AuditLog.action.in_(sorted(_OPERATION_RECORD_ACTIONS)),
                AuditLog.action.like("login%"),
            ),
        )
        .order_by(AuditLog.created_at.desc())
        .limit(_OPERATION_RECORD_LIMIT)
    )
    rows = list(result.scalars().all())
    operations: list[SecurityOperationOut] = []
    for row in rows:
        browser, system, kind = parse_user_agent(row.user_agent)
        device_label = getattr(row, "device_label", None)
        if device_label and str(device_label).strip():
            device = str(device_label).strip()
        else:
            device = browser if browser != "未知设备" else "未知设备"
            if system and system != "未知系统":
                device = f"{browser} · {system}"
        action = _ACTION_LABELS.get(row.action)
        if action is None and row.action.startswith("login"):
            action = "登录/切换账号"
        if row.action in {"logout", "session.revoke"}:
            status = "已退出"
        else:
            status = "设备活跃"
        location_text = getattr(row, "location", None) or row.ip or "-"
        app_name = _app_name_for_client(getattr(row, "client_id", None))
        operations.append(
            SecurityOperationOut(
                id=str(row.id),
                action=action or row.action,
                device=device,
                occurred_at=_format_timestamp(row.created_at),
                location=location_text,
                kind=kind,  # type: ignore[arg-type]
                app_name=app_name,
                ip_address=row.ip,
                ip_masked=mask_ip(row.ip),
                status=status,
            )
        )
    return operations


async def list_authorized_applications(
    db: AsyncSession,
    user: User,
) -> list[AuthorizedApplicationOut]:
    consents = await list_active_consents(db, user.id)
    applications: list[AuthorizedApplicationOut] = []
    for consent in consents:
        name = await resolve_client_name(db, consent.client_id)
        if name == consent.client_id:
            name = _CLIENT_LABELS.get(consent.client_id.lower(), consent.client_id)
        applications.append(
            AuthorizedApplicationOut(
                id=consent.client_id,
                name=name,
                description=_scope_description(consent.scopes),
                authorized_at=_format_timestamp(consent.authorized_at)[:10].replace("-", "/"),
                scopes=consent.scopes,
            )
        )
    return applications


async def revoke_authorized_application(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    client_id: str,
    meta: SessionMeta | None = None,
) -> None:
    try:
        await revoke_oauth_consent(db, user_id=user_id, client_id=client_id, meta=meta)
    except ConsentError as exc:
        raise SecurityError(exc.code, exc.message, status_code=exc.status_code) from exc


async def revoke_security_session(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    session_id: uuid.UUID,
    current_session_id: uuid.UUID | None,
    meta: SessionMeta | None = None,
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
    seed = result.scalar_one_or_none()
    if seed is None:
        raise SecurityError("not_found", "Session not found", status_code=404)

    display_name = _session_display_name(seed)
    active_sessions = await _load_active_sessions(db, user_id)
    targets = [
        session
        for session in active_sessions
        if _session_display_name(session) == display_name
        and (current_session_id is None or session.id != current_session_id)
    ]
    if not targets:
        raise SecurityError("not_found", "Session not found", status_code=404)

    now = _utcnow()
    revoked_ids: list[str] = []
    for session in targets:
        session.revoked_at = now
        session.last_seen_at = now
        revoked_ids.append(str(session.id))

        token_result = await db.execute(
            select(RefreshToken).where(
                RefreshToken.session_id == session.id,
                RefreshToken.revoked_at.is_(None),
            )
        )
        for token in token_result.scalars().all():
            token.revoked_at = now

    await record_audit(
        db,
        actor_user_id=user_id,
        action="session.revoke",
        target_type="session",
        target_id=",".join(revoked_ids),
        ip=meta.ip_address if meta else seed.ip_address,
        user_agent=meta.user_agent if meta else seed.user_agent,
    )
    await db.commit()
