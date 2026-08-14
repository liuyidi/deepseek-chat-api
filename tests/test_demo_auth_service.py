import unittest
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

from app.schemas.auth import AuthResponse, TokenResponse, UserResponse
from app.services.auth_service import demo_login_user


class DemoLoginUserTest(unittest.IsolatedAsyncioTestCase):
    async def test_creates_demo_user_and_issues_normal_tokens(self) -> None:
        db = MagicMock()
        db.flush = AsyncMock()
        created_user = None

        def add_user(user):
            nonlocal created_user
            created_user = user

        tokens = TokenResponse(
            access_token="access",
            refresh_token="refresh",
            expires_in=1800,
        )
        user_response = UserResponse.model_validate(
            SimpleNamespace(
                id=UUID("00000000-0000-0000-0000-000000000001"),
                email="demo@mini-auth.dev",
                nickname="demo",
                bio=None,
                avatar_url=None,
                phone=None,
                created_at=datetime(2026, 8, 14, tzinfo=UTC),
            )
        )

        with (
            patch("app.services.auth_service.get_user_by_email", new=AsyncMock(return_value=None)),
            patch("app.services.auth_service.hash_password", return_value="hashed-demo-password"),
            patch("app.services.auth_service.issue_tokens", new=AsyncMock(return_value=tokens)),
            patch("app.services.auth_service.to_user_response", return_value=user_response),
        ):
            db.add.side_effect = add_user

            result = await demo_login_user(db, email="Demo@Mini-Auth.Dev", nickname=" demo ")

        self.assertIsInstance(result, AuthResponse)
        self.assertIsNotNone(created_user)
        self.assertEqual(created_user.email, "demo@mini-auth.dev")
        self.assertEqual(created_user.nickname, "demo")
        self.assertEqual(created_user.password_hash, "hashed-demo-password")
        self.assertEqual(result.tokens.access_token, "access")

    async def test_reuses_existing_demo_user(self) -> None:
        db = MagicMock()
        db.flush = AsyncMock()
        existing_user = SimpleNamespace(
            id=UUID("00000000-0000-0000-0000-000000000001"),
            email="demo@mini-auth.dev",
            nickname="demo",
            bio=None,
            avatar_url=None,
            phone=None,
            created_at=datetime(2026, 8, 14, tzinfo=UTC),
        )
        response = AuthResponse(
            user=UserResponse.model_validate(existing_user),
            tokens=TokenResponse(access_token="access", refresh_token="refresh", expires_in=1800),
        )

        with (
            patch("app.services.auth_service.get_user_by_email", new=AsyncMock(return_value=existing_user)),
            patch("app.services.auth_service.issue_tokens", new=AsyncMock(return_value=response.tokens)),
        ):
            result = await demo_login_user(db, email="demo@mini-auth.dev", nickname="demo")

        db.add.assert_not_called()
        self.assertEqual(result.user.email, "demo@mini-auth.dev")
        self.assertEqual(result.user.nickname, "demo")
