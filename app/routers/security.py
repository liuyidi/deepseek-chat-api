import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.security import (
    AuthorizedApplicationOut,
    SecurityOperationOut,
    SecuritySnapshotOut,
)
from app.services.auth_service import AuthError, get_session_id_from_access_token
from app.services.security_service import (
    SecurityError,
    build_security_snapshot,
    list_authorized_applications,
    list_security_operations,
    revoke_security_session,
)
from app.deps import _extract_access_token

router = APIRouter(prefix="/api/v1/security", tags=["security"])


def _current_session_id(request: Request) -> uuid.UUID | None:
    token = _extract_access_token(request)
    if token is None:
        return None
    try:
        return get_session_id_from_access_token(token)
    except AuthError:
        return None


@router.get("/snapshot", response_model=SecuritySnapshotOut)
async def security_snapshot(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SecuritySnapshotOut:
    return await build_security_snapshot(
        db,
        current_user,
        current_session_id=_current_session_id(request),
    )


@router.get("/operations", response_model=list[SecurityOperationOut])
async def security_operations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[SecurityOperationOut]:
    return await list_security_operations(db, current_user)


@router.get("/applications", response_model=list[AuthorizedApplicationOut])
async def security_applications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[AuthorizedApplicationOut]:
    return await list_authorized_applications(db, current_user)


@router.delete("/sessions/{session_id}", status_code=204)
async def revoke_session(
    session_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    try:
        await revoke_security_session(
            db,
            user_id=current_user.id,
            session_id=session_id,
            current_session_id=_current_session_id(request),
        )
    except SecurityError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.code) from exc
