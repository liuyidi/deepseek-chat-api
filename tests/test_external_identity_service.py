import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from app.models.user import User, UserIdentity
from app.services.external_auth_types import ExternalAuthError, ProviderIdentity
from app.services.external_identity_service import resolve_external_identity


def github_identity(email: str | None = "person@example.com", verified: bool = True) -> ProviderIdentity:
    return ProviderIdentity(
        provider="github",
        subject="12345",
        email=email,
        email_verified=verified,
        display_name="Octo Person",
        avatar_url="https://avatars.example/12345",
    )


class ExternalIdentityServiceTest(unittest.IsolatedAsyncioTestCase):
    async def test_reuses_existing_subject_and_refreshes_profile_snapshot(self) -> None:
        user = SimpleNamespace(deleted_at=None)
        existing = SimpleNamespace(user=user, email="old@example.com", display_name="Old", avatar_url=None)
        result = MagicMock()
        result.scalar_one_or_none.return_value = existing
        db = MagicMock()
        db.execute = AsyncMock(return_value=result)
        db.commit = AsyncMock()

        resolved = await resolve_external_identity(db, github_identity())

        self.assertIs(resolved, user)
        self.assertEqual(existing.email, "person@example.com")
        self.assertEqual(existing.display_name, "Octo Person")
        self.assertEqual(existing.avatar_url, "https://avatars.example/12345")
        db.commit.assert_awaited_once()

    async def test_creates_user_and_identity_for_unused_verified_email(self) -> None:
        result = MagicMock()
        result.scalar_one_or_none.return_value = None
        db = MagicMock()
        db.execute = AsyncMock(return_value=result)
        db.flush = AsyncMock()
        db.commit = AsyncMock()
        added: list[object] = []
        db.add.side_effect = added.append

        with (
            patch("app.services.external_identity_service.get_user_by_email", new=AsyncMock(return_value=None)),
            patch("app.services.external_identity_service.hash_password", return_value="random-hash"),
        ):
            user = await resolve_external_identity(db, github_identity())

        self.assertIsInstance(user, User)
        self.assertEqual(user.email, "person@example.com")
        self.assertEqual(user.password_hash, "random-hash")
        identity = next(item for item in added if isinstance(item, UserIdentity))
        self.assertEqual(identity.provider, "github")
        self.assertEqual(identity.provider_subject, "12345")
        self.assertIs(identity.user, user)

    async def test_rejects_existing_email_without_link(self) -> None:
        result = MagicMock()
        result.scalar_one_or_none.return_value = None
        db = MagicMock()
        db.execute = AsyncMock(return_value=result)

        with patch(
            "app.services.external_identity_service.get_user_by_email",
            new=AsyncMock(return_value=SimpleNamespace(id="existing")),
        ):
            with self.assertRaises(ExternalAuthError) as caught:
                await resolve_external_identity(db, github_identity())

        self.assertEqual(caught.exception.code, "account_link_required")
        db.add.assert_not_called()

    async def test_requires_verified_email_for_new_github_identity(self) -> None:
        result = MagicMock()
        result.scalar_one_or_none.return_value = None
        db = MagicMock()
        db.execute = AsyncMock(return_value=result)

        with self.assertRaises(ExternalAuthError) as caught:
            await resolve_external_identity(db, github_identity(email=None, verified=False))

        self.assertEqual(caught.exception.code, "verified_email_required")


if __name__ == "__main__":
    unittest.main()
