from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.database import get_db
from app.routers.oidc import router
from app.schemas.oidc import DEVICE_CODE_GRANT_TYPE
from app.services.oidc_service import DeviceTokenPendingError


class DeviceFlowTest(unittest.TestCase):
    def setUp(self) -> None:
        app = FastAPI()
        app.include_router(router)

        async def fake_db():
            yield AsyncMock()

        app.dependency_overrides[get_db] = fake_db
        self.client = TestClient(app)

    def test_device_start_returns_verification_urls(self) -> None:
        with patch(
            "app.routers.oidc.start_device_authorization",
            new=AsyncMock(
                return_value={
                    "device_code": "dev-1",
                    "user_code": "LCKR-JRGX",
                    "verification_uri": "https://auth.liuyidi.me/oauth/device",
                    "verification_uri_complete": "https://auth.liuyidi.me/oauth/device?user_code=LCKR-JRGX",
                    "expires_in": 900,
                    "interval": 5,
                }
            ),
        ):
            response = self.client.post(
                "/oauth/device/start",
                json={"client_id": "minibot", "scope": "openid profile email"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["verification_uri"], "https://auth.liuyidi.me/oauth/device")
        self.assertEqual(response.json()["user_code"], "LCKR-JRGX")

    def test_device_token_pending_uses_standard_device_error(self) -> None:
        with patch(
            "app.routers.oidc.exchange_device_code",
            new=AsyncMock(side_effect=DeviceTokenPendingError("authorization_pending")),
        ):
            response = self.client.post(
                "/oauth/token",
                json={
                    "grant_type": "device_code",
                    "client_id": "minibot",
                    "device_code": "dev-1",
                },
            )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "authorization_pending")

    def test_device_token_accepts_standard_device_grant_type(self) -> None:
        with patch(
            "app.routers.oidc.exchange_device_code",
            new=AsyncMock(side_effect=DeviceTokenPendingError("authorization_pending")),
        ):
            response = self.client.post(
                "/oauth/token",
                json={
                    "grant_type": DEVICE_CODE_GRANT_TYPE,
                    "client_id": "minibot",
                    "device_code": "dev-1",
                },
            )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "authorization_pending")

    def test_device_request_returns_snapshot(self) -> None:
        with patch(
            "app.routers.oidc.get_device_request_snapshot",
            new=AsyncMock(
                return_value={
                    "user_code": "LCKR-JRGX",
                    "client_id": "minibot",
                    "scope": "openid profile email",
                    "verification_uri": "https://auth.liuyidi.me/oauth/device",
                    "device_label": "DdeMacBook-Pro.local @ vercel 59.1.4 node-v22.23.1 darwin (arm64)",
                    "location": "Tuenmen, Hong Kong",
                    "created_at": "2026-08-20T15:48:00+00:00",
                    "ip_address": "219.77.144.7",
                    "user_agent": "vercel/59.1.4",
                    "status": "pending",
                    "approved_user": None,
                    "approved_at": None,
                }
            ),
        ):
            response = self.client.get("/oauth/device/request?user_code=lckr-jrgx")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["device_label"], "DdeMacBook-Pro.local @ vercel 59.1.4 node-v22.23.1 darwin (arm64)")


if __name__ == "__main__":
    unittest.main()
