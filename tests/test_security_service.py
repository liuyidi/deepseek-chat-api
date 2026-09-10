import unittest
import uuid
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock

from fastapi import FastAPI

from app.database import get_db
from app.models.user import AuditLog, AuthSession, User, UserIdentity
from app.routers.security import router
from app.schemas.security import SecurityDeviceOut
from app.services.ip_mask import mask_ip
from app.services.security_service import (
    SecurityError,
    _dedupe_devices_by_name,
    build_security_snapshot,
    list_security_operations,
    revoke_security_session,
)


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

    def test_dedupe_devices_by_name_prefers_current(self) -> None:
        older = SecurityDeviceOut(
            id="1",
            name="Chrome",
            system="macOS",
            logged_in_at="2026/08/14 09:00:00",
            last_seen_at="2026/08/14 09:00:00",
            kind="browser",
            is_current=False,
        )
        current = SecurityDeviceOut(
            id="2",
            name="Chrome",
            system="macOS",
            logged_in_at="2026/08/14 10:00:00",
            last_seen_at="2026/08/14 10:00:00",
            kind="browser",
            is_current=True,
        )
        safari = SecurityDeviceOut(
            id="3",
            name="Safari",
            system="iOS",
            logged_in_at="2026/08/13 21:00:00",
            last_seen_at="2026/08/13 21:00:00",
            kind="mobile",
            is_current=False,
        )
        deduped = _dedupe_devices_by_name([older, current, safari, safari])
        self.assertEqual([device.id for device in deduped], ["2", "3"])
        self.assertTrue(deduped[0].is_current)

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
        self.assertEqual(snapshot.devices[0].app_name, "Minibot")
        self.assertIsNotNone(snapshot.devices[0].last_seen_at)
        password = next(item for item in snapshot.settings if item.id == "login-password")
        self.assertEqual(password.status, "unset")
        login_methods = next(item for item in snapshot.settings if item.id == "login-methods")
        self.assertEqual(login_methods.status, "set")
        self.assertIn("GitHub", login_methods.description)

    async def test_build_snapshot_dedupes_devices_by_name(self) -> None:
        user = self._user()
        current_id = uuid.uuid4()
        other_id = uuid.uuid4()
        sessions = [
            AuthSession(
                id=current_id,
                user_id=user.id,
                client_id="minibot",
                user_agent="Mozilla/5.0 (Macintosh) Chrome/120.0.0.0 Safari/537.36",
                created_at=datetime.now(UTC),
                expires_at=datetime.now(UTC) + timedelta(days=30),
                last_seen_at=datetime.now(UTC),
            ),
            AuthSession(
                id=other_id,
                user_id=user.id,
                client_id="minibot",
                user_agent="Mozilla/5.0 (Macintosh) Chrome/119.0.0.0 Safari/537.36",
                created_at=datetime.now(UTC) - timedelta(hours=1),
                expires_at=datetime.now(UTC) + timedelta(days=30),
                last_seen_at=datetime.now(UTC) - timedelta(hours=1),
            ),
        ]
        db = AsyncMock()
        db.execute = AsyncMock(
            return_value=SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: sessions))
        )

        snapshot = await build_security_snapshot(db, user, current_session_id=current_id)
        self.assertEqual(len(snapshot.devices), 1)
        self.assertEqual(snapshot.devices[0].name, "Chrome")
        self.assertTrue(snapshot.devices[0].is_current)

    def test_mask_ip_ipv4(self) -> None:
        self.assertEqual(mask_ip("115.196.84.12"), "115.196.84.***")
        self.assertIsNone(mask_ip(None))
        self.assertIsNone(mask_ip(""))

    async def test_list_security_operations_includes_enriched_fields(self) -> None:
        user = self._user()
        row = AuditLog(
            id=uuid.uuid4(),
            actor_user_id=user.id,
            action="login.email_code",
            ip="115.196.84.12",
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
            created_at=datetime.now(UTC),
        )
        db = AsyncMock()
        db.execute = AsyncMock(
            return_value=SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [row]))
        )
        ops = await list_security_operations(db, user)
        self.assertEqual(len(ops), 1)
        self.assertEqual(ops[0].kind, "mobile")
        self.assertEqual(ops[0].ip_masked, "115.196.84.***")
        self.assertEqual(ops[0].status, "设备活跃")
        self.assertEqual(ops[0].ip_address, "115.196.84.12")

    async def test_list_security_operations_uses_stored_device_metadata(self) -> None:
        user = self._user()
        row = AuditLog(
            id=uuid.uuid4(),
            actor_user_id=user.id,
            action="login.email_code",
            ip="115.196.84.12",
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
            device_label="iPhone 14 Plus",
            client_id="minibot",
            location="浙江省杭州市",
            created_at=datetime.now(UTC),
        )
        db = AsyncMock()
        db.execute = AsyncMock(
            return_value=SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [row]))
        )
        ops = await list_security_operations(db, user)
        self.assertEqual(len(ops), 1)
        self.assertEqual(ops[0].device, "iPhone 14 Plus")
        self.assertEqual(ops[0].app_name, "Minibot")
        self.assertIn("杭州", ops[0].location)

    async def test_list_security_operations_logout_status(self) -> None:
        user = self._user()
        row = AuditLog(
            id=uuid.uuid4(),
            actor_user_id=user.id,
            action="logout",
            ip="10.0.0.1",
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
            created_at=datetime.now(UTC),
        )
        db = AsyncMock()
        db.execute = AsyncMock(
            return_value=SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [row]))
        )
        ops = await list_security_operations(db, user)
        self.assertEqual(len(ops), 1)
        self.assertEqual(ops[0].status, "已退出")

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
