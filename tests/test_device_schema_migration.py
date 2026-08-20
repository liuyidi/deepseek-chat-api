from __future__ import annotations

import subprocess
import sys
import unittest
from pathlib import Path


class DeviceSchemaMigrationTest(unittest.TestCase):
    def test_device_metadata_columns_are_added_after_revision_005(self) -> None:
        repository_root = Path(__file__).resolve().parents[1]
        result = subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "005:head", "--sql"],
            cwd=repository_root,
            check=True,
            capture_output=True,
            text=True,
        )

        for column_name in ("device_label", "location", "ip_address", "user_agent"):
            expected = (
                "ALTER TABLE device_authorization_requests "
                f"ADD COLUMN {column_name}"
            )
            self.assertIn(expected, result.stdout)


if __name__ == "__main__":
    unittest.main()
