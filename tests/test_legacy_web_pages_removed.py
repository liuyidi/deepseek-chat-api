import unittest

from app.routers.web import router


class LegacyWebPagesRemovedTest(unittest.TestCase):
    def test_legacy_html_pages_are_not_registered(self) -> None:
        registered_paths = {route.path for route in router.routes}

        self.assertNotIn("/login", registered_paths)
        self.assertNotIn("/login/email", registered_paths)
        self.assertNotIn("/register", registered_paths)
        self.assertNotIn("/oidc/demo", registered_paths)
        self.assertNotIn("/oidc/demo/callback", registered_paths)

    def test_logout_route_remains_available(self) -> None:
        registered_paths = {route.path for route in router.routes}

        self.assertIn("/logout", registered_paths)
