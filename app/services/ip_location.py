"""Resolve client IP to a short Chinese location label (省/市)."""

from __future__ import annotations

import ipaddress
import logging
from functools import lru_cache

import httpx

logger = logging.getLogger(__name__)

_PRIVATE_LABEL = "本地网络"
_TIMEOUT = 1.5


def is_private_or_local_ip(ip: str | None) -> bool:
    if not ip:
        return True
    value = ip.strip()
    if not value:
        return True
    try:
        addr = ipaddress.ip_address(value.split("%")[0])
    except ValueError:
        return True
    return bool(
        addr.is_private
        or addr.is_loopback
        or addr.is_link_local
        or addr.is_reserved
        or addr.is_multicast
    )


def _format_zh_location(payload: dict) -> str | None:
    region = str(payload.get("regionName") or "").strip()
    city = str(payload.get("city") or "").strip()
    if region and city and region != city:
        return f"{region}{city}"[:255]
    if city:
        return city[:255]
    if region:
        return region[:255]
    country = str(payload.get("country") or "").strip()
    return country[:255] if country else None


@lru_cache(maxsize=2048)
def resolve_ip_location(ip: str | None) -> str | None:
    """Return geo label for an IP. Private/local → 本地网络. Public → best-effort lookup."""
    if not ip or not ip.strip():
        return None
    value = ip.strip()
    if is_private_or_local_ip(value):
        return _PRIVATE_LABEL

    try:
        response = httpx.get(
            f"http://ip-api.com/json/{value}",
            params={"lang": "zh-CN", "fields": "status,country,regionName,city"},
            timeout=_TIMEOUT,
        )
        if response.status_code != 200:
            return None
        data = response.json()
        if not isinstance(data, dict) or data.get("status") != "success":
            return None
        return _format_zh_location(data)
    except Exception:
        logger.debug("ip location lookup failed for %s", value, exc_info=True)
        return None
