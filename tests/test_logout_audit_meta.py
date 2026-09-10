import unittest
import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.services.auth_service import logout_user
from app.services.request_context import SessionMeta


class LogoutAuditMetaTest(unittest.IsolatedAsyncioTestCase):
    async def test_logout_audit_falls_back_to_session_device_metadata(self) -> None:
        session_id = uuid.uuid4()
        user_id = uuid.uuid4()
        session = SimpleNamespace(
            id=session_id,
            user_id=user_id,
            device_label="iPhone 14 Plus",
            location="浙江省杭州市",
            ip_address="10.0.0.1",
            user_agent="Mozilla/5.0",
            client_id="minibot",
            revoked_at=None,
            last_seen_at=None,
        )
        stored = SimpleNamespace(revoked_at=None)
        db = AsyncMock()
        db.execute = AsyncMock(
            return_value=SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: []))
        )
        record_audit = AsyncMock()

        with (
            patch(
                "app.services.auth_service.decode_token",
                return_value={"token_use": "refresh", "jti": "jti-1"},
            ),
            patch(
                "app.services.auth_service._load_refresh_bundle",
                new=AsyncMock(return_value=(stored, session)),
            ),
            patch("app.services.auth_service.record_audit", new=record_audit),
            patch("app.services.auth_service._utcnow", return_value=datetime.now(UTC)),
        ):
            await logout_user(db, "refresh-token", meta=SessionMeta())

        record_audit.assert_awaited_once()
        kwargs = record_audit.await_args.kwargs
        self.assertEqual(kwargs["device_label"], "iPhone 14 Plus")
        self.assertEqual(kwargs["location"], "浙江省杭州市")
        self.assertEqual(kwargs["client_id"], "minibot")
