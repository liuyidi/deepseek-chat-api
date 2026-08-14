from __future__ import annotations

import json

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import AuthClient

DEMO_CLIENT_ID = "minibot"
DEMO_CLIENT_NAME = "minibot demo client"
BOT_REDIRECT_URI = "https://bot.liuyidi.me/auth/mini-auth/callback"
BOT_HTTP_REDIRECT_URI = "http://bot.liuyidi.me/auth/mini-auth/callback"
BOT_HTTPS_REDIRECT_URI = "https://bot.liuyidi.me/auth/mini-auth/callback"
MINIBOT_REDIRECT_URI = "http://127.0.0.1:8766/auth/mini-auth/callback"
MINIBOT_LOCALHOST_REDIRECT_URI = "http://localhost:8766/auth/mini-auth/callback"
MINIBOT_DESKTOP_REDIRECT_URI = "minibot://auth/callback"
DEMO_ALLOWED_SCOPES = ["openid", "profile", "email"]
LEGACY_DEMO_REDIRECT_URI = "http://127.0.0.1:8000/oidc/demo/callback"
DEFAULT_REDIRECT_URIS = list(
    dict.fromkeys(
        [
            BOT_REDIRECT_URI,
            BOT_HTTP_REDIRECT_URI,
            BOT_HTTPS_REDIRECT_URI,
            MINIBOT_REDIRECT_URI,
            MINIBOT_LOCALHOST_REDIRECT_URI,
            MINIBOT_DESKTOP_REDIRECT_URI,
        ]
    )
)


def _dump_list(values: list[str]) -> str:
    return json.dumps(values, ensure_ascii=False)


def _load_list(raw: str) -> list[str]:
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            return [str(item).strip() for item in parsed if str(item).strip()]
    except json.JSONDecodeError:
        pass
    return [item.strip() for item in raw.replace("\n", ",").split(",") if item.strip()]


async def ensure_demo_oauth_client(db: AsyncSession) -> None:
    result = await db.execute(select(AuthClient).where(AuthClient.client_id == DEMO_CLIENT_ID))
    client = result.scalar_one_or_none()

    if client is None:
        db.add(
            AuthClient(
                client_id=DEMO_CLIENT_ID,
                client_secret_hash=None,
                name=DEMO_CLIENT_NAME,
                redirect_uris=_dump_list(DEFAULT_REDIRECT_URIS),
                allowed_scopes=_dump_list(DEMO_ALLOWED_SCOPES),
                pkce_required=True,
                status="active",
            )
        )
        await db.commit()
        return

    redirect_uris = _load_list(client.redirect_uris)
    allowed_scopes = _load_list(client.allowed_scopes)
    changed = False

    normalized_redirect_uris = [
        redirect_uri for redirect_uri in redirect_uris if redirect_uri != LEGACY_DEMO_REDIRECT_URI
    ]
    if normalized_redirect_uris != redirect_uris:
        redirect_uris = normalized_redirect_uris
        changed = True

    merged_redirect_uris = list(dict.fromkeys([*redirect_uris, *DEFAULT_REDIRECT_URIS]))
    if merged_redirect_uris != redirect_uris:
        redirect_uris = merged_redirect_uris
        changed = True

    normalized_scopes = list(dict.fromkeys([*allowed_scopes, *DEMO_ALLOWED_SCOPES]))
    if normalized_scopes != allowed_scopes:
        allowed_scopes = normalized_scopes
        changed = True

    if client.name != DEMO_CLIENT_NAME:
        client.name = DEMO_CLIENT_NAME
        changed = True

    if client.status != "active":
        client.status = "active"
        changed = True

    if not client.pkce_required:
        client.pkce_required = True
        changed = True

    if redirect_uris != _load_list(client.redirect_uris):
        client.redirect_uris = _dump_list(redirect_uris)
        changed = True

    if allowed_scopes != _load_list(client.allowed_scopes):
        client.allowed_scopes = _dump_list(allowed_scopes)
        changed = True

    if changed:
        await db.commit()
