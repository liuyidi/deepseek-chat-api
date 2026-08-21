"""Request / User-Agent helpers for session metadata."""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import Request


@dataclass(frozen=True, slots=True)
class SessionMeta:
    user_agent: str | None = None
    ip_address: str | None = None
    device_label: str | None = None
    location: str | None = None


def client_ip_from_request(request: Request) -> str | None:
    forwarded = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    if forwarded:
        return forwarded[:64]
    if request.client and request.client.host:
        return request.client.host[:64]
    return None


def session_meta_from_request(
    request: Request,
    *,
    device_label: str | None = None,
    location: str | None = None,
) -> SessionMeta:
    user_agent = (request.headers.get("user-agent") or "").strip() or None
    if user_agent and len(user_agent) > 500:
        user_agent = user_agent[:500]
    label = (device_label or request.headers.get("x-device-label") or "").strip() or None
    if label and len(label) > 255:
        label = label[:255]
    loc = (location or "").strip() or None
    if loc and len(loc) > 255:
        loc = loc[:255]
    return SessionMeta(
        user_agent=user_agent,
        ip_address=client_ip_from_request(request),
        device_label=label,
        location=loc,
    )


def parse_user_agent(user_agent: str | None) -> tuple[str, str, str]:
    """Return (browser_name, system, kind) with kind in browser|desktop|mobile."""
    ua = (user_agent or "").strip()
    if not ua:
        return "未知设备", "未知系统", "browser"

    lower = ua.lower()
    kind = "browser"
    if any(token in lower for token in ("iphone", "android", "mobile", "ipad")):
        kind = "mobile"
    elif any(token in lower for token in ("electron", "minibot-cli", "curl/", "python-requests", "go-http")):
        kind = "desktop"

    system = "未知系统"
    if "mac os" in lower or "macintosh" in lower:
        system = "macOS"
    elif "windows" in lower:
        system = "Windows"
    elif "android" in lower:
        system = "Android"
    elif "iphone" in lower or "ipad" in lower or "ios" in lower:
        system = "iOS"
    elif "linux" in lower:
        system = "Linux"
    elif "darwin" in lower:
        system = "macOS"

    browser = "浏览器"
    if "edg/" in lower:
        browser = "Edge"
    elif "chrome/" in lower and "edg/" not in lower:
        browser = "Chrome"
    elif "safari/" in lower and "chrome/" not in lower:
        browser = "Safari"
    elif "firefox/" in lower:
        browser = "Firefox"
    elif "minibot-cli" in lower or "vercel" in lower:
        browser = "CLI"
    elif kind == "desktop":
        browser = "桌面客户端"

    return browser, system, kind
