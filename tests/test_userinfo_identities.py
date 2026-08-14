import unittest
import uuid
from unittest.mock import MagicMock

from app.services.oidc_service import userinfo_from_user


class UserinfoIdentitiesTest(unittest.TestCase):
    def test_includes_github_identity_display_name(self) -> None:
        identity = MagicMock()
        identity.provider = "github"
        identity.display_name = "octocat"
        user = MagicMock()
        user.id = uuid.UUID("11111111-1111-1111-1111-111111111111")
        user.email = "person@example.com"
        user.nickname = "person"
        user.avatar_url = None
        user.phone = None
        user.identities = [identity]

        info = userinfo_from_user(user)

        self.assertEqual(
            info["identities"],
            [{"provider": "github", "display_name": "octocat"}],
        )

    def test_identities_empty_when_none(self) -> None:
        user = MagicMock()
        user.id = uuid.UUID("11111111-1111-1111-1111-111111111111")
        user.email = "person@example.com"
        user.nickname = "person"
        user.avatar_url = None
        user.phone = None
        user.identities = []

        info = userinfo_from_user(user)

        self.assertEqual(info["identities"], [])
