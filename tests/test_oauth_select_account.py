"""Custom-scheme authorize shows select-account before issuing a code."""

from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.database import get_db
from app.routers.oidc import router
from app.services.oidc_service import is_custom_scheme_redirect_uri


def test_is_custom_scheme_redirect_uri() -> None:
    assert is_custom_scheme_redirect_uri("minibot://auth/callback") is True
    assert is_custom_scheme_redirect_uri("https://bot.liuyidi.me/auth/mini-auth/callback") is False
    assert is_custom_scheme_redirect_uri("http://127.0.0.1:8766/auth/mini-auth/callback") is False
    assert is_custom_scheme_redirect_uri("MINIBOT://auth/callback") is True


def _make_client() -> TestClient:
    app = FastAPI()
    app.include_router(router)

    async def _override_db():
        yield AsyncMock()

    app.dependency_overrides[get_db] = _override_db
    return TestClient(app)


def _authorize_query(*, redirect_uri: str, confirmed: bool = False) -> str:
    params = (
        "response_type=code"
        "&client_id=minibot"
        f"&redirect_uri={redirect_uri}"
        "&scope=openid+profile+email"
        "&state=abc"
        "&code_challenge=challenge"
        "&code_challenge_method=S256"
    )
    if confirmed:
        params += "&account_confirmed=1"
    return f"/oauth/authorize?{params}"


def test_https_redirect_with_session_issues_code() -> None:
    user = SimpleNamespace(id=uuid.uuid4())
    client = _make_client()
    with (
        patch("app.routers.oidc.resolve_current_user", new=AsyncMock(return_value=user)),
        patch("app.routers.oidc.validate_client_redirect_uri", new=AsyncMock()),
        patch("app.routers.oidc.validate_client_scopes", new=AsyncMock()),
        patch("app.routers.oidc.create_authorization_code", return_value="auth-code") as create_code,
    ):
        response = client.get(
            _authorize_query(redirect_uri="https%3A%2F%2Fbot.liuyidi.me%2Fauth%2Fmini-auth%2Fcallback"),
            follow_redirects=False,
        )

    assert response.status_code == 302
    assert response.headers["location"].startswith(
        "https://bot.liuyidi.me/auth/mini-auth/callback?code=auth-code"
    )
    create_code.assert_called_once()


def test_custom_scheme_with_session_redirects_to_select_account() -> None:
    user = SimpleNamespace(id=uuid.uuid4())
    client = _make_client()
    with (
        patch("app.routers.oidc.resolve_current_user", new=AsyncMock(return_value=user)),
        patch("app.routers.oidc.create_authorization_code") as create_code,
    ):
        response = client.get(
            _authorize_query(redirect_uri="minibot%3A%2F%2Fauth%2Fcallback"),
            follow_redirects=False,
        )

    assert response.status_code == 302
    location = response.headers["location"]
    assert location.startswith("/oauth/select-account?")
    assert "redirect_uri=minibot%3A%2F%2Fauth%2Fcallback" in location
    assert "client_id=minibot" in location
    assert "account_confirmed" not in location
    create_code.assert_not_called()


def test_custom_scheme_confirmed_issues_code() -> None:
    user = SimpleNamespace(id=uuid.uuid4())
    client = _make_client()
    with (
        patch("app.routers.oidc.resolve_current_user", new=AsyncMock(return_value=user)),
        patch("app.routers.oidc.validate_client_redirect_uri", new=AsyncMock()),
        patch("app.routers.oidc.validate_client_scopes", new=AsyncMock()),
        patch("app.routers.oidc.create_authorization_code", return_value="auth-code"),
    ):
        response = client.get(
            _authorize_query(redirect_uri="minibot%3A%2F%2Fauth%2Fcallback", confirmed=True),
            follow_redirects=False,
        )

    assert response.status_code == 302
    assert response.headers["location"].startswith("minibot://auth/callback?code=auth-code")
    assert "state=abc" in response.headers["location"]


def test_custom_scheme_without_session_goes_to_login() -> None:
    client = _make_client()
    with patch("app.routers.oidc.resolve_current_user", new=AsyncMock(return_value=None)):
        response = client.get(
            _authorize_query(redirect_uri="minibot%3A%2F%2Fauth%2Fcallback"),
            follow_redirects=False,
        )

    assert response.status_code == 302
    assert response.headers["location"].startswith("/login?next=")
    assert "oauth%2Fauthorize" in response.headers["location"]
