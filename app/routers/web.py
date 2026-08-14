from fastapi import APIRouter, Query
from fastapi.responses import RedirectResponse, Response

from app.deps import ACCESS_TOKEN_COOKIE

router = APIRouter(tags=["web"], include_in_schema=False)


def _normalized_next_url(next_url: str | None) -> str:
    return (next_url or "").strip()


@router.get("/logout")
async def logout(next: str = Query(default="")) -> Response:
    next_url = _normalized_next_url(next)
    if next_url:
        response: Response = RedirectResponse(url=next_url, status_code=302)
    else:
        response = Response(status_code=204)
    response.delete_cookie(ACCESS_TOKEN_COOKIE, path="/")
    response.delete_cookie("mini_auth_refresh_token", path="/")
    return response
