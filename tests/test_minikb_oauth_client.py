"""Bootstrap registers the minikb OIDC public client."""

from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, MagicMock

from app.services.bootstrap_service import (
    MINIKB_CLIENT_ID,
    MINIKB_REDIRECT_URIS,
    _load_list,
    ensure_minikb_oauth_client,
)


class MinikbOAuthClientTest(unittest.IsolatedAsyncioTestCase):
    async def test_creates_minikb_client_with_prod_redirect(self) -> None:
        db = MagicMock()
        db.commit = AsyncMock()

        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=result_mock)

        added: list[object] = []
        db.add.side_effect = lambda client: added.append(client)

        await ensure_minikb_oauth_client(db)

        self.assertEqual(len(added), 1)
        client = added[0]
        self.assertEqual(client.client_id, MINIKB_CLIENT_ID)
        redirect_uris = _load_list(client.redirect_uris)
        self.assertIn("https://kb.liuyidi.me/login/callback", redirect_uris)
        self.assertEqual(redirect_uris, MINIKB_REDIRECT_URIS)
        self.assertTrue(client.pkce_required)
        db.commit.assert_awaited_once()

    async def test_merges_missing_redirect_uris_on_existing_client(self) -> None:
        db = MagicMock()
        db.commit = AsyncMock()

        existing = MagicMock()
        existing.client_id = MINIKB_CLIENT_ID
        existing.name = "minikb admin"
        existing.status = "active"
        existing.pkce_required = True
        existing.redirect_uris = '["http://127.0.0.1:3000/login/callback"]'
        existing.allowed_scopes = '["openid", "profile", "email"]'

        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = existing
        db.execute = AsyncMock(return_value=result_mock)

        await ensure_minikb_oauth_client(db)

        redirect_uris = _load_list(existing.redirect_uris)
        self.assertIn("https://kb.liuyidi.me/login/callback", redirect_uris)
        db.commit.assert_awaited_once()
