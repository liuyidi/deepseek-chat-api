import hashlib
import json

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import AuthClient
from app.schemas.admin import AuthClientCreateRequest, AuthClientResponse


def _hash_client_secret(secret: str | None) -> str | None:
    if secret is None:
        return None
    return hashlib.sha256(secret.encode("utf-8")).hexdigest()


def _dump_list(values: list[str]) -> str:
    return json.dumps(values, ensure_ascii=False)


def _load_list(raw: str) -> list[str]:
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            return [str(item) for item in parsed if str(item).strip()]
    except json.JSONDecodeError:
        pass
    return [item.strip() for item in raw.replace("\n", ",").split(",") if item.strip()]


def to_client_response(client: AuthClient) -> AuthClientResponse:
    return AuthClientResponse(
        client_id=client.client_id,
        name=client.name,
        redirect_uris=_load_list(client.redirect_uris),
        allowed_scopes=_load_list(client.allowed_scopes),
        pkce_required=client.pkce_required,
        status=client.status,
    )


async def create_auth_client(db: AsyncSession, body: AuthClientCreateRequest) -> AuthClientResponse:
    client = AuthClient(
        client_id=body.client_id,
        client_secret_hash=_hash_client_secret(body.client_secret),
        name=body.name,
        redirect_uris=_dump_list(body.redirect_uris),
        allowed_scopes=_dump_list(body.allowed_scopes),
        pkce_required=body.pkce_required,
        status=body.status,
    )
    db.add(client)
    await db.commit()
    await db.refresh(client)
    return to_client_response(client)


async def list_auth_clients(db: AsyncSession) -> list[AuthClientResponse]:
    result = await db.execute(select(AuthClient).order_by(AuthClient.client_id.asc()))
    return [to_client_response(client) for client in result.scalars().all()]
