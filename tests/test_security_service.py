import unittest
import uuid
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI

from app.database import get_db
from app.models.user import AuthSession, User, UserIdentity
from app.routers.security import router
from app.services.security_service import SecurityError, build_security_snapshot, revoke_security_session


class SecurityServiceTest(unittest.IsolatedAsyncioTestCase):
    def _user(self) -> User:
        user = User(
            id=uuid.uuid4(),
            email="demo@example.com",
            password_hash="hash",
            nickname="Demo User",
        )
        user.identities = [
            UserIdentity(
                provider="github",
                provider_subject="1",
                email="demo@example.com",
                email_verified=True,
            )
        ]
        return user

    async def test_build_snapshot_marks_password_unset_for_external_identities(self) -> None:
        user = self._user()
        session = AuthSession(
            id=uuid.uuid4(),
            user_id=user.id,
            client_id="minibot",
            created_at=datetime.now(UTC),
            expires_at=datetime.now(UTC) + timedelta(days=30),
            last_seen_at=datetime.now(UTC),
        )
        db = AsyncMock()
        db.execute = AsyncMock(
            return_value=SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [session]))
        )

        snapshot = await build_security_snapshot(db, user, current_session_id=session.id)

        self.assertEqual(snapshot.user.email, "demo@example.com")
        self.assertTrue(snapshot.devices[0].is_current)
        password = next(item for item in snapshot.settings if item.id == "login-password")
        self.assertEqual(password.status, "unset")
        login_methods = next(item for item in snapshot.settings if item.id == "login-methods")
        self.assertEqual(login_methods.status, "set")
        self.assertIn("GitHub", login_methods.description)

    async def test_revoke_session_rejects_current_device(self) -> None:
        session_id = uuid.uuid4()
        db = AsyncMock()
        with self.assertRaises(SecurityError) as caught:
            await revoke_security_session(
                db,
                user_id=uuid.uuid4(),
                session_id=session_id,
                current_session_id=session_id,
            )
        self.assertEqual(caught.exception.code, "current_device")


class SecurityRouterTest(unittest.TestCase):
    def setUp(self) -> None:
        app = FastAPI()
        app.include_router(router)
        self.client = None

    def test_snapshot_requires_authentication(self) -> None:
        app = FastAPI()
        app.include_router(router)

        async def fake_db():
            yield SimpleNamespace()

        app.dependency_overrides[get_db] = fake_db

        from fastapi.testclient import TestClient

        client = TestClient(app)
        response = client.get("/api/v1/security/snapshot")
        self.assertEqual(response.status_code, 401)


if __name__ == "__main__":
    unittest.main()
