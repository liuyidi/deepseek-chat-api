from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps_admin import require_admin_api_key
from app.schemas.admin import AuthClientCreateRequest, AuthClientResponse
from app.services.admin_service import create_auth_client, list_auth_clients

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin_api_key)])


@router.post("/clients", response_model=AuthClientResponse, status_code=201)
async def create_client(
    body: AuthClientCreateRequest,
    db: AsyncSession = Depends(get_db),
) -> AuthClientResponse:
    return await create_auth_client(db, body)


@router.get("/clients", response_model=list[AuthClientResponse])
async def get_clients(db: AsyncSession = Depends(get_db)) -> list[AuthClientResponse]:
    return await list_auth_clients(db)
