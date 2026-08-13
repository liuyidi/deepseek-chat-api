from __future__ import annotations

import asyncio
import html
from functools import lru_cache

from alibabacloud_dm20151123 import client as dm_client
from alibabacloud_dm20151123 import models as dm_models
from alibabacloud_tea_openapi import models as openapi_models

from app.config import settings
from app.services.auth_service import AuthError


def _sender_address() -> str:
    return f"{settings.email_sender_account}@{settings.email_sender_domain}"


def _render_login_code_html(code: str, expires_in_seconds: int) -> str:
    safe_code = html.escape(code)
    minutes = max(1, expires_in_seconds // 60)
    return f"""<!doctype html>
<html lang="zh-CN">
  <body style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937">
    <p>你好，</p>
    <p>你正在登录 Minibot，验证码如下：</p>
    <div style="font-size:32px;font-weight:700;letter-spacing:6px;margin:16px 0;padding:16px 20px;background:#f3f4f6;border-radius:12px;display:inline-block;">{safe_code}</div>
    <p>验证码 {minutes} 分钟内有效，请勿泄露给他人。</p>
    <p>如果不是你本人操作，请忽略这封邮件。</p>
  </body>
</html>"""


@lru_cache(maxsize=1)
def _build_client() -> dm_client.Client:
    if not settings.email_service_api_key or not settings.email_service_secret:
        raise AuthError("Email service credentials are not configured", status_code=503)

    config = openapi_models.Config(
        access_key_id=settings.email_service_api_key,
        access_key_secret=settings.email_service_secret,
        region_id=settings.email_service_region,
    )
    return dm_client.Client(config)


def _send_login_code_sync(to_address: str, code: str, expires_in_seconds: int) -> None:
    if settings.email_debug_return_code:
        return

    request = dm_models.SingleSendMailRequest(
        account_name=_sender_address(),
        address_type=1,
        reply_to_address=False,
        subject="Minibot 登录验证码",
        to_address=to_address,
        from_alias=settings.email_from_alias,
        click_trace="0",
        html_body=_render_login_code_html(code, expires_in_seconds),
    )

    client = _build_client()
    try:
        client.single_send_mail(request)
    except Exception as exc:  # pragma: no cover - SDK/network failures
        raise AuthError("Failed to send verification email", status_code=502) from exc


async def send_login_code_email(to_address: str, code: str, expires_in_seconds: int) -> None:
    await asyncio.to_thread(_send_login_code_sync, to_address, code, expires_in_seconds)
