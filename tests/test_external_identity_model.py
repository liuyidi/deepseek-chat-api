import unittest

from app.models.user import UserIdentity


class UserIdentityModelTest(unittest.TestCase):
    def test_external_identity_keys_are_unique_per_provider(self) -> None:
        table = UserIdentity.__table__
        constraints = {constraint.name for constraint in table.constraints}

        self.assertEqual(table.name, "user_identities")
        self.assertFalse(table.c.provider.nullable)
        self.assertFalse(table.c.provider_subject.nullable)
        self.assertIn("uq_user_identities_provider_subject", constraints)
        self.assertIn("uq_user_identities_provider_union_id", constraints)

    def test_external_identity_belongs_to_user(self) -> None:
        relationship = UserIdentity.__mapper__.relationships["user"]

        self.assertEqual(relationship.back_populates, "identities")


if __name__ == "__main__":
    unittest.main()
