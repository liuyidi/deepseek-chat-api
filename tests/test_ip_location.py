import unittest
from unittest.mock import MagicMock, patch

from app.services.ip_location import (
    is_private_or_local_ip,
    resolve_ip_location,
)


class IpLocationTest(unittest.TestCase):
    def setUp(self) -> None:
        resolve_ip_location.cache_clear()

    def test_private_ips_map_to_local_network(self) -> None:
        self.assertTrue(is_private_or_local_ip("127.0.0.1"))
        self.assertTrue(is_private_or_local_ip("192.168.112.77"))
        self.assertTrue(is_private_or_local_ip("10.0.0.8"))
        self.assertEqual(resolve_ip_location("192.168.112.77"), "本地网络")

    def test_public_ip_formats_province_city(self) -> None:
        response = MagicMock()
        response.status_code = 200
        response.json.return_value = {
            "status": "success",
            "country": "中国",
            "regionName": "浙江省",
            "city": "杭州市",
        }
        with patch("app.services.ip_location.httpx.get", return_value=response) as get:
            self.assertEqual(resolve_ip_location("115.196.84.12"), "浙江省杭州市")
            get.assert_called_once()

    def test_lookup_failure_returns_none(self) -> None:
        with patch("app.services.ip_location.httpx.get", side_effect=TimeoutError()):
            self.assertIsNone(resolve_ip_location("8.8.8.8"))


if __name__ == "__main__":
    unittest.main()
