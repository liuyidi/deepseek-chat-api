from urllib.parse import quote

from fastapi import APIRouter, Query, Request
from fastapi.responses import HTMLResponse, RedirectResponse, Response

from app.deps import ACCESS_TOKEN_COOKIE

router = APIRouter(tags=["web"], include_in_schema=False)

DEMO_CLIENT_ID = "minibot"


def _request_origin(request: Request) -> str:
    return str(request.base_url).rstrip("/")


def _normalized_next_url(next_url: str | None) -> str:
    return (next_url or "").strip()


def _login_page_html(*, next_url: str, error: str = "", email: str = "") -> str:
    next_attr = next_url.replace('"', "&quot;")
    email_attr = email.replace('"', "&quot;")
    error_block = (
        f'<div class="alert">{error}</div>' if error else '<div class="alert hidden" id="errorBox"></div>'
    )
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>mini-auth 登录</title>
  <style>
    :root {{
      color-scheme: light;
      --bg: #f6f1e8;
      --bg-2: #e7ddd2;
      --card: rgba(255,255,255,0.74);
      --card-border: rgba(72, 53, 32, 0.12);
      --ink: #20160f;
      --muted: #6a5a4b;
      --accent: #b76e3f;
      --accent-2: #7c3f19;
      --shadow: 0 30px 80px rgba(59, 40, 24, 0.18);
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      min-height: 100vh;
      font-family: "Avenir Next", "Segoe UI", "PingFang SC", "Hiragino Sans GB", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at 12% 18%, rgba(183,110,63,.14), transparent 26%),
        radial-gradient(circle at 84% 22%, rgba(124,63,25,.12), transparent 24%),
        linear-gradient(135deg, var(--bg), var(--bg-2));
      display: grid;
      place-items: center;
      padding: 24px;
    }}
    .shell {{
      width: min(1080px, 100%);
      display: grid;
      grid-template-columns: 1.1fr 0.9fr;
      gap: 24px;
      align-items: center;
    }}
    .hero {{
      padding: 32px 20px;
    }}
    .eyebrow {{
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(255,255,255,0.5);
      border: 1px solid rgba(72, 53, 32, 0.08);
      color: var(--muted);
      font-size: 13px;
      letter-spacing: .02em;
    }}
    .dot {{
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: linear-gradient(180deg, #f59f5b, #b76e3f);
      box-shadow: 0 0 0 6px rgba(183,110,63,.12);
    }}
    h1 {{
      margin: 18px 0 12px;
      font-family: "Iowan Old Style", "Palatino Linotype", Georgia, serif;
      font-size: clamp(42px, 6vw, 72px);
      line-height: .95;
      letter-spacing: -0.05em;
    }}
    .lead {{
      max-width: 560px;
      color: var(--muted);
      font-size: 18px;
      line-height: 1.7;
      margin: 0 0 28px;
    }}
    .bullets {{
      display: grid;
      gap: 12px;
      margin: 0;
      padding: 0;
      list-style: none;
      color: var(--muted);
      font-size: 14px;
    }}
    .bullets li {{
      display: flex;
      align-items: center;
      gap: 10px;
    }}
    .check {{
      width: 20px;
      height: 20px;
      border-radius: 999px;
      background: rgba(183,110,63,.12);
      color: var(--accent-2);
      display: inline-grid;
      place-items: center;
      font-size: 12px;
      flex: 0 0 auto;
    }}
    .card {{
      backdrop-filter: blur(18px);
      background: var(--card);
      border: 1px solid var(--card-border);
      border-radius: 28px;
      padding: 30px;
      box-shadow: var(--shadow);
    }}
    .title {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 20px;
    }}
    .brand {{
      display: flex;
      align-items: center;
      gap: 12px;
      font-weight: 700;
      letter-spacing: -0.03em;
    }}
    .brand-mark {{
      width: 42px;
      height: 42px;
      border-radius: 14px;
      background: linear-gradient(180deg, #fff, #efdcc9);
      border: 1px solid rgba(72, 53, 32, 0.12);
      display: grid;
      place-items: center;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.7);
    }}
    .brand-mark span {{
      font-size: 21px;
      color: var(--accent-2);
    }}
    .subtle {{
      color: var(--muted);
      font-size: 13px;
    }}
    .alert {{
      padding: 12px 14px;
      border-radius: 14px;
      background: rgba(185, 28, 28, 0.1);
      color: #8a1d1d;
      border: 1px solid rgba(185, 28, 28, 0.18);
      font-size: 14px;
      line-height: 1.5;
      margin-bottom: 16px;
    }}
    .hidden {{
      display: none;
    }}
    label {{
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #423223;
      margin-bottom: 8px;
    }}
    input {{
      width: 100%;
      border: 1px solid rgba(72, 53, 32, 0.16);
      background: rgba(255,255,255,0.78);
      border-radius: 16px;
      padding: 14px 16px;
      font-size: 15px;
      color: var(--ink);
      outline: none;
      transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease;
    }}
    input:focus {{
      border-color: rgba(183,110,63,.48);
      box-shadow: 0 0 0 4px rgba(183,110,63,.12);
      transform: translateY(-1px);
    }}
    .field + .field {{
      margin-top: 16px;
    }}
    .button {{
      width: 100%;
      border: 0;
      margin-top: 20px;
      border-radius: 16px;
      padding: 14px 16px;
      background: linear-gradient(180deg, #c97b49, #a45528);
      color: white;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 18px 34px rgba(164, 85, 40, 0.25);
      transition: transform .18s ease, box-shadow .18s ease, opacity .18s ease;
    }}
    .button:hover {{
      transform: translateY(-1px);
      box-shadow: 0 22px 40px rgba(164, 85, 40, 0.32);
    }}
    .button:disabled {{
      opacity: .65;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }}
    .footer {{
      margin-top: 16px;
      display: flex;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      color: var(--muted);
      font-size: 13px;
    }}
    .footer a {{
      color: var(--accent-2);
      text-decoration: none;
    }}
    .next {{
      word-break: break-all;
      margin-top: 6px;
      font-size: 12px;
      color: var(--muted);
    }}
    @media (max-width: 900px) {{
      .shell {{
        grid-template-columns: 1fr;
      }}
      .hero {{
        padding: 0 4px;
      }}
    }}
  </style>
</head>
<body>
  <main class="shell">
    <section class="hero">
      <div class="eyebrow"><span class="dot"></span>统一身份中心 · auth.liuyidi.me</div>
      <h1>先登录，<br/>再把身份带回去。</h1>
      <p class="lead">这是 mini-auth 的最小认证 Web 页。登录后会把你带回 OIDC 授权流程，接着就能给 minibot 这类客户端签发 access token。</p>
      <ul class="bullets">
        <li><span class="check">✓</span>邮箱 / 密码登录</li>
        <li><span class="check">✓</span>OIDC authorize 回跳</li>
        <li><span class="check">✓</span>后续可直接接 minibot</li>
      </ul>
    </section>

    <section class="card">
      <div class="title">
        <div class="brand">
          <div class="brand-mark"><span>◌</span></div>
          <div>
            <div>mini-auth</div>
            <div class="subtle">Sign in to continue</div>
          </div>
        </div>
        <div class="subtle">Web page</div>
      </div>

      {error_block}

      <form id="loginForm">
        <input type="hidden" id="nextInput" value="{next_attr}" />
        <div class="field">
          <label for="email">邮箱</label>
          <input id="email" name="email" type="email" autocomplete="email" value="{email_attr}" placeholder="you@example.com" required />
        </div>
        <div class="field">
          <label for="password">密码</label>
          <input id="password" name="password" type="password" autocomplete="current-password" placeholder="••••••••" required />
        </div>
        <button id="submitBtn" class="button" type="submit">登录并继续</button>
        <div class="footer">
          <span>登录后会写入本地会话 cookie。</span>
          <a href="/login/email?next={next_attr}">邮箱验证码登录</a>
          <a href="/register?next={next_attr}">去注册</a>
          <a href="/docs">API 文档</a>
        </div>
        <div class="next" id="nextHint">Next: {next_attr or "/docs"}</div>
      </form>
    </section>
  </main>

  <script>
    const form = document.getElementById("loginForm");
    const errorBox = document.getElementById("errorBox");
    const submitBtn = document.getElementById("submitBtn");
    const nextInput = document.getElementById("nextInput");
    const nextHint = document.getElementById("nextHint");

    const setError = (message) => {{
      if (!errorBox) return;
      errorBox.textContent = message;
      errorBox.classList.remove("hidden");
    }};

    const setBusy = (busy) => {{
      submitBtn.disabled = busy;
      submitBtn.textContent = busy ? "登录中..." : "登录并继续";
    }};

    form.addEventListener("submit", async (e) => {{
      e.preventDefault();
      setError("");
      setBusy(true);

      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      const next = nextInput.value || "/docs";

      try {{
        const response = await fetch("/api/v1/auth/login", {{
          method: "POST",
          headers: {{ "Content-Type": "application/json" }},
          body: JSON.stringify({{ email, password }}),
        }});

        const data = await response.json().catch(() => ({{}}));
        if (!response.ok) {{
          throw new Error(data.detail || "登录失败");
        }}

        const accessToken = data?.tokens?.access_token;
        const refreshToken = data?.tokens?.refresh_token;
        if (!accessToken || !refreshToken) {{
          throw new Error("登录响应缺少 token");
        }}

        document.cookie = "{ACCESS_TOKEN_COOKIE}=" + encodeURIComponent(accessToken) + "; Path=/; SameSite=Lax";
        document.cookie = "mini_auth_refresh_token=" + encodeURIComponent(refreshToken) + "; Path=/; SameSite=Lax";

        if (next) {{
          window.location.assign(next);
          return;
        }}
        window.location.assign("/docs");
      }} catch (err) {{
        setError(err instanceof Error ? err.message : "登录失败");
      }} finally {{
        setBusy(false);
      }}
    }});

    if (nextInput.value) {{
      nextHint.textContent = "Next: " + nextInput.value;
    }}
  </script>
</body>
</html>"""


def _email_login_page_html(*, next_url: str, error: str = "", email: str = "") -> str:
    next_attr = next_url.replace('"', "&quot;")
    email_attr = email.replace('"', "&quot;")
    error_block = (
        f'<div class="alert">{error}</div>' if error else '<div class="alert hidden" id="errorBox"></div>'
    )
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Minibot 邮箱验证码登录</title>
  <style>
    :root {{
      color-scheme: light;
      --bg: #f6f1e8;
      --bg-2: #e7ddd2;
      --card: rgba(255,255,255,0.74);
      --card-border: rgba(72, 53, 32, 0.12);
      --ink: #20160f;
      --muted: #6a5a4b;
      --accent: #b76e3f;
      --accent-2: #7c3f19;
      --shadow: 0 30px 80px rgba(59, 40, 24, 0.18);
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      min-height: 100vh;
      font-family: "Avenir Next", "Segoe UI", "PingFang SC", "Hiragino Sans GB", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at 12% 18%, rgba(183,110,63,.14), transparent 26%),
        radial-gradient(circle at 84% 22%, rgba(124,63,25,.12), transparent 24%),
        linear-gradient(135deg, var(--bg), var(--bg-2));
      display: grid;
      place-items: center;
      padding: 24px;
    }}
    .shell {{
      width: min(1080px, 100%);
      display: grid;
      grid-template-columns: 1.1fr 0.9fr;
      gap: 24px;
      align-items: center;
    }}
    .hero {{
      padding: 32px 20px;
    }}
    .eyebrow {{
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(255,255,255,0.5);
      border: 1px solid rgba(72, 53, 32, 0.08);
      color: var(--muted);
      font-size: 13px;
    }}
    .dot {{
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: linear-gradient(180deg, #f59f5b, #b76e3f);
      box-shadow: 0 0 0 6px rgba(183,110,63,.12);
    }}
    h1 {{
      margin: 18px 0 12px;
      font-family: "Iowan Old Style", "Palatino Linotype", Georgia, serif;
      font-size: clamp(42px, 6vw, 72px);
      line-height: .95;
      letter-spacing: -0.05em;
    }}
    .lead {{
      max-width: 560px;
      color: var(--muted);
      font-size: 18px;
      line-height: 1.7;
      margin: 0 0 28px;
    }}
    .bullets {{
      display: grid;
      gap: 12px;
      margin: 0;
      padding: 0;
      list-style: none;
      color: var(--muted);
      font-size: 14px;
    }}
    .bullets li {{
      display: flex;
      align-items: center;
      gap: 10px;
    }}
    .check {{
      width: 20px;
      height: 20px;
      border-radius: 999px;
      background: rgba(183,110,63,.12);
      color: var(--accent-2);
      display: inline-grid;
      place-items: center;
      font-size: 12px;
      flex: 0 0 auto;
    }}
    .card {{
      backdrop-filter: blur(18px);
      background: var(--card);
      border: 1px solid var(--card-border);
      border-radius: 28px;
      padding: 30px;
      box-shadow: var(--shadow);
    }}
    .title {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 20px;
    }}
    .brand {{
      display: flex;
      align-items: center;
      gap: 12px;
      font-weight: 700;
      letter-spacing: -0.03em;
    }}
    .brand-mark {{
      width: 42px;
      height: 42px;
      border-radius: 14px;
      background: linear-gradient(180deg, #fff, #efdcc9);
      border: 1px solid rgba(72, 53, 32, 0.12);
      display: grid;
      place-items: center;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.7);
    }}
    .brand-mark span {{
      font-size: 21px;
      color: var(--accent-2);
    }}
    .subtle {{ color: var(--muted); font-size: 13px; }}
    .alert {{
      padding: 12px 14px;
      border-radius: 14px;
      background: rgba(185, 28, 28, 0.1);
      color: #8a1d1d;
      border: 1px solid rgba(185, 28, 28, 0.18);
      font-size: 14px;
      line-height: 1.5;
      margin-bottom: 16px;
    }}
    .hidden {{ display: none; }}
    label {{
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #423223;
      margin-bottom: 8px;
    }}
    input {{
      width: 100%;
      border: 1px solid rgba(72, 53, 32, 0.16);
      background: rgba(255,255,255,0.78);
      border-radius: 16px;
      padding: 14px 16px;
      font-size: 15px;
      color: var(--ink);
      outline: none;
    }}
    input:focus {{
      border-color: rgba(183,110,63,.48);
      box-shadow: 0 0 0 4px rgba(183,110,63,.12);
      transform: translateY(-1px);
    }}
    .field + .field {{ margin-top: 16px; }}
    .button {{
      width: 100%;
      border: 0;
      margin-top: 20px;
      border-radius: 16px;
      padding: 14px 16px;
      background: linear-gradient(180deg, #c97b49, #a45528);
      color: white;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 18px 34px rgba(164, 85, 40, 0.25);
    }}
    .button.secondary {{
      background: rgba(255,255,255,0.8);
      color: #4f3725;
      border: 1px solid rgba(72, 53, 32, 0.14);
      box-shadow: none;
    }}
    .button:disabled {{
      opacity: .65;
      cursor: not-allowed;
      box-shadow: none;
    }}
    .row {{
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 12px;
      margin-top: 16px;
      align-items: end;
    }}
    .footer {{
      margin-top: 16px;
      display: flex;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      color: var(--muted);
      font-size: 13px;
    }}
    .footer a {{
      color: var(--accent-2);
      text-decoration: none;
    }}
    .next {{
      word-break: break-all;
      margin-top: 6px;
      font-size: 12px;
      color: var(--muted);
    }}
    .debug {{
      margin-top: 14px;
      padding: 12px 14px;
      border-radius: 14px;
      background: rgba(124, 63, 25, 0.08);
      color: #6b3414;
      border: 1px solid rgba(124, 63, 25, 0.14);
      font-size: 13px;
      line-height: 1.6;
    }}
    @media (max-width: 900px) {{
      .shell {{ grid-template-columns: 1fr; }}
      .hero {{ padding: 0 4px; }}
    }}
  </style>
</head>
<body>
  <main class="shell">
    <section class="hero">
      <div class="eyebrow"><span class="dot"></span>Minibot 邮箱验证码登录</div>
      <h1>用邮箱验证码，<br/>直接完成登录。</h1>
      <p class="lead">先把邮箱验证码登录跑通，登录成功后会签发 access token 和 refresh token，再把身份带回 minibot。</p>
      <ul class="bullets">
        <li><span class="check">✓</span>邮箱验证码发送</li>
        <li><span class="check">✓</span>验证码校验后自动建号</li>
        <li><span class="check">✓</span>登录后回跳到 OIDC 流程</li>
      </ul>
    </section>

    <section class="card">
      <div class="title">
        <div class="brand">
          <div class="brand-mark"><span>✉</span></div>
          <div>
            <div>Minibot</div>
            <div class="subtle">Email code sign in</div>
          </div>
        </div>
        <div class="subtle">Web page</div>
      </div>

      {error_block}

      <form id="emailForm">
        <input type="hidden" id="nextInput" value="{next_attr}" />
        <div class="field">
          <label for="email">邮箱</label>
          <input id="email" name="email" type="email" autocomplete="email" value="{email_attr}" placeholder="you@example.com" required />
        </div>
        <button id="sendBtn" class="button secondary" type="button">发送验证码</button>
        <div class="field">
          <label for="code">验证码</label>
          <input id="code" name="code" inputmode="numeric" autocomplete="one-time-code" placeholder="输入 6 位验证码" required />
        </div>
        <div class="row">
          <button id="verifyBtn" class="button" type="submit">验证并登录</button>
          <button id="resendBtn" class="button secondary" type="button" disabled>重新发送</button>
        </div>
        <div class="footer">
          <a href="/login?next={next_attr}">返回密码登录</a>
          <a href="/docs">API 文档</a>
        </div>
        <div class="next" id="nextHint">Next: {next_attr or "/docs"}</div>
        <div class="debug hidden" id="debugBox"></div>
      </form>
    </section>
  </main>

  <script>
    const errorBox = document.getElementById("errorBox");
    const debugBox = document.getElementById("debugBox");
    const sendBtn = document.getElementById("sendBtn");
    const resendBtn = document.getElementById("resendBtn");
    const verifyBtn = document.getElementById("verifyBtn");
    const nextInput = document.getElementById("nextInput");
    const nextHint = document.getElementById("nextHint");
    const cooldownSecondsDefault = 60;
    let cooldown = 0;
    let timer = null;

    const setError = (message) => {{
      if (!errorBox) return;
      if (!message) {{
        errorBox.classList.add("hidden");
        errorBox.textContent = "";
        return;
      }}
      errorBox.textContent = message;
      errorBox.classList.remove("hidden");
    }};

    const setDebug = (message) => {{
      if (!debugBox) return;
      if (!message) {{
        debugBox.classList.add("hidden");
        debugBox.textContent = "";
        return;
      }}
      debugBox.textContent = message;
      debugBox.classList.remove("hidden");
    }};

    const setBusy = (busy) => {{
      verifyBtn.disabled = busy;
      sendBtn.disabled = busy || cooldown > 0;
      resendBtn.disabled = busy || cooldown > 0;
      verifyBtn.textContent = busy ? "登录中..." : "验证并登录";
      sendBtn.textContent = busy ? "发送中..." : "发送验证码";
    }};

    const tick = () => {{
      if (cooldown <= 0) {{
        clearInterval(timer);
        timer = null;
        resendBtn.disabled = false;
        resendBtn.textContent = "重新发送";
        sendBtn.disabled = false;
        return;
      }}
      resendBtn.textContent = "重新发送 (" + cooldown + "s)";
      sendBtn.disabled = true;
      resendBtn.disabled = true;
      cooldown -= 1;
    }};

    const startCooldown = (seconds) => {{
      cooldown = seconds;
      if (timer) clearInterval(timer);
      tick();
      timer = setInterval(tick, 1000);
    }};

    const getEmail = () => document.getElementById("email").value.trim();
    const getCode = () => document.getElementById("code").value.trim();

    async function sendCode() {{
      setError("");
      setDebug("");
      const email = getEmail();
      if (!email) {{
        setError("请先输入邮箱");
        return;
      }}
      setBusy(true);
      try {{
        const response = await fetch("/api/v1/auth/email/start", {{
          method: "POST",
          headers: {{ "Content-Type": "application/json" }},
          body: JSON.stringify({{ email }}),
        }});
        const data = await response.json().catch(() => ({{}}));
        if (!response.ok) {{
          throw new Error(data.detail || "发送验证码失败");
        }}
        startCooldown(data.resend_after_seconds || cooldownSecondsDefault);
        if (data.debug_code) {{
          setDebug(`调试验证码：${{data.debug_code}}`);
          document.getElementById("code").value = data.debug_code;
        }}
      }} catch (err) {{
        setError(err instanceof Error ? err.message : "发送验证码失败");
      }} finally {{
        setBusy(false);
      }}
    }}

    async function verifyCode(e) {{
      e.preventDefault();
      setError("");
      const email = getEmail();
      const code = getCode();
      const next = nextInput.value || "/docs";
      if (!email || !code) {{
        setError("请先输入邮箱和验证码");
        return;
      }}
      setBusy(true);
      try {{
        const response = await fetch("/api/v1/auth/email/verify", {{
          method: "POST",
          headers: {{ "Content-Type": "application/json" }},
          body: JSON.stringify({{ email, code }}),
        }});
        const data = await response.json().catch(() => ({{}}));
        if (!response.ok) {{
          throw new Error(data.detail || "登录失败");
        }}

        const accessToken = data?.tokens?.access_token;
        const refreshToken = data?.tokens?.refresh_token;
        if (!accessToken || !refreshToken) {{
          throw new Error("登录响应缺少 token");
        }}

        document.cookie = "{ACCESS_TOKEN_COOKIE}=" + encodeURIComponent(accessToken) + "; Path=/; SameSite=Lax";
        document.cookie = "mini_auth_refresh_token=" + encodeURIComponent(refreshToken) + "; Path=/; SameSite=Lax";

        if (next) {{
          window.location.assign(next);
          return;
        }}
        window.location.assign("/docs");
      }} catch (err) {{
        setError(err instanceof Error ? err.message : "登录失败");
      }} finally {{
        setBusy(false);
      }}
    }}

    document.getElementById("sendBtn").addEventListener("click", sendCode);
    document.getElementById("resendBtn").addEventListener("click", sendCode);
    document.getElementById("emailForm").addEventListener("submit", verifyCode);

    if (nextInput.value) {{
      nextHint.textContent = "Next: " + nextInput.value;
    }}
  </script>
</body>
</html>"""


def _register_page_html(*, next_url: str, error: str = "", email: str = "", nickname: str = "") -> str:
    next_attr = next_url.replace('"', "&quot;")
    email_attr = email.replace('"', "&quot;")
    nickname_attr = nickname.replace('"', "&quot;")
    error_block = (
        f'<div class="alert">{error}</div>' if error else '<div class="alert hidden" id="errorBox"></div>'
    )
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>mini-auth 注册</title>
  <style>
    :root {{
      color-scheme: light;
      --bg: #f6f1e8;
      --bg-2: #e7ddd2;
      --card: rgba(255,255,255,0.74);
      --card-border: rgba(72, 53, 32, 0.12);
      --ink: #20160f;
      --muted: #6a5a4b;
      --accent: #b76e3f;
      --accent-2: #7c3f19;
      --shadow: 0 30px 80px rgba(59, 40, 24, 0.18);
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      min-height: 100vh;
      font-family: "Avenir Next", "Segoe UI", "PingFang SC", "Hiragino Sans GB", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at 12% 18%, rgba(183,110,63,.14), transparent 26%),
        radial-gradient(circle at 84% 22%, rgba(124,63,25,.12), transparent 24%),
        linear-gradient(135deg, var(--bg), var(--bg-2));
      display: grid;
      place-items: center;
      padding: 24px;
    }}
    .shell {{
      width: min(1080px, 100%);
      display: grid;
      grid-template-columns: 1.1fr 0.9fr;
      gap: 24px;
      align-items: center;
    }}
    .hero {{
      padding: 32px 20px;
    }}
    .eyebrow {{
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(255,255,255,0.5);
      border: 1px solid rgba(72, 53, 32, 0.08);
      color: var(--muted);
      font-size: 13px;
      letter-spacing: .02em;
    }}
    .dot {{
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: linear-gradient(180deg, #f59f5b, #b76e3f);
      box-shadow: 0 0 0 6px rgba(183,110,63,.12);
    }}
    h1 {{
      margin: 18px 0 12px;
      font-family: "Iowan Old Style", "Palatino Linotype", Georgia, serif;
      font-size: clamp(42px, 6vw, 72px);
      line-height: .95;
      letter-spacing: -0.05em;
    }}
    .lead {{
      max-width: 560px;
      color: var(--muted);
      font-size: 18px;
      line-height: 1.7;
      margin: 0 0 28px;
    }}
    .bullets {{
      display: grid;
      gap: 12px;
      margin: 0;
      padding: 0;
      list-style: none;
      color: var(--muted);
      font-size: 14px;
    }}
    .bullets li {{
      display: flex;
      align-items: center;
      gap: 10px;
    }}
    .check {{
      width: 20px;
      height: 20px;
      border-radius: 999px;
      background: rgba(183,110,63,.12);
      color: var(--accent-2);
      display: inline-grid;
      place-items: center;
      font-size: 12px;
      flex: 0 0 auto;
    }}
    .card {{
      backdrop-filter: blur(18px);
      background: var(--card);
      border: 1px solid var(--card-border);
      border-radius: 28px;
      padding: 30px;
      box-shadow: var(--shadow);
    }}
    .title {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 20px;
    }}
    .brand {{
      display: flex;
      align-items: center;
      gap: 12px;
      font-weight: 700;
      letter-spacing: -0.03em;
    }}
    .brand-mark {{
      width: 42px;
      height: 42px;
      border-radius: 14px;
      background: linear-gradient(180deg, #fff, #efdcc9);
      border: 1px solid rgba(72, 53, 32, 0.12);
      display: grid;
      place-items: center;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.7);
    }}
    .brand-mark span {{
      font-size: 21px;
      color: var(--accent-2);
    }}
    .subtle {{
      color: var(--muted);
      font-size: 13px;
    }}
    .alert {{
      padding: 12px 14px;
      border-radius: 14px;
      background: rgba(185, 28, 28, 0.1);
      color: #8a1d1d;
      border: 1px solid rgba(185, 28, 28, 0.18);
      font-size: 14px;
      line-height: 1.5;
      margin-bottom: 16px;
    }}
    .hidden {{
      display: none;
    }}
    label {{
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #423223;
      margin-bottom: 8px;
    }}
    input {{
      width: 100%;
      border: 1px solid rgba(72, 53, 32, 0.16);
      background: rgba(255,255,255,0.78);
      border-radius: 16px;
      padding: 14px 16px;
      font-size: 15px;
      color: var(--ink);
      outline: none;
      transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease;
    }}
    input:focus {{
      border-color: rgba(183,110,63,.48);
      box-shadow: 0 0 0 4px rgba(183,110,63,.12);
      transform: translateY(-1px);
    }}
    .field + .field {{
      margin-top: 16px;
    }}
    .button {{
      width: 100%;
      border: 0;
      margin-top: 20px;
      border-radius: 16px;
      padding: 14px 16px;
      background: linear-gradient(180deg, #c97b49, #a45528);
      color: white;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 18px 34px rgba(164, 85, 40, 0.25);
      transition: transform .18s ease, box-shadow .18s ease, opacity .18s ease;
    }}
    .button:hover {{
      transform: translateY(-1px);
      box-shadow: 0 22px 40px rgba(164, 85, 40, 0.32);
    }}
    .button:disabled {{
      opacity: .65;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }}
    .footer {{
      margin-top: 16px;
      display: flex;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      color: var(--muted);
      font-size: 13px;
    }}
    .footer a {{
      color: var(--accent-2);
      text-decoration: none;
    }}
    .next {{
      word-break: break-all;
      margin-top: 6px;
      font-size: 12px;
      color: var(--muted);
    }}
    @media (max-width: 900px) {{
      .shell {{
        grid-template-columns: 1fr;
      }}
      .hero {{
        padding: 0 4px;
      }}
    }}
  </style>
</head>
<body>
  <main class="shell">
    <section class="hero">
      <div class="eyebrow"><span class="dot"></span>统一身份中心 · auth.liuyidi.me</div>
      <h1>先注册，<br/>再把身份带回去。</h1>
      <p class="lead">这是 mini-auth 的最小注册 Web 页。注册成功后会直接给你签发会话，再带回 OIDC 授权流程，继续给 minibot 完成鉴权。</p>
      <ul class="bullets">
        <li><span class="check">✓</span>邮箱 / 密码注册</li>
        <li><span class="check">✓</span>自动创建并登录账号</li>
        <li><span class="check">✓</span>注册后可直接回到 OIDC demo</li>
      </ul>
    </section>

    <section class="card">
      <div class="title">
        <div class="brand">
          <div class="brand-mark"><span>◌</span></div>
          <div>
            <div>mini-auth</div>
            <div class="subtle">Create an account</div>
          </div>
        </div>
        <div class="subtle">Web page</div>
      </div>

      {error_block}

      <form id="registerForm">
        <input type="hidden" id="nextInput" value="{next_attr}" />
        <div class="field">
          <label for="email">邮箱</label>
          <input id="email" name="email" type="email" autocomplete="email" value="{email_attr}" placeholder="you@example.com" required />
        </div>
        <div class="field">
          <label for="nickname">昵称</label>
          <input id="nickname" name="nickname" type="text" autocomplete="nickname" value="{nickname_attr}" placeholder="你的昵称" required />
        </div>
        <div class="field">
          <label for="password">密码</label>
          <input id="password" name="password" type="password" autocomplete="new-password" placeholder="至少 8 位" required />
        </div>
        <button id="submitBtn" class="button" type="submit">注册并继续</button>
        <div class="footer">
          <span>注册后会写入本地会话 cookie。</span>
          <a href="/login?next={next_attr}">去登录</a>
        </div>
        <div class="next" id="nextHint">Next: {next_attr or "/docs"}</div>
      </form>
    </section>
  </main>

  <script>
    const form = document.getElementById("registerForm");
    const errorBox = document.getElementById("errorBox");
    const submitBtn = document.getElementById("submitBtn");
    const nextInput = document.getElementById("nextInput");
    const nextHint = document.getElementById("nextHint");

    const setError = (message) => {{
      if (!errorBox) return;
      errorBox.textContent = message;
      errorBox.classList.remove("hidden");
    }};

    const setBusy = (busy) => {{
      submitBtn.disabled = busy;
      submitBtn.textContent = busy ? "注册中..." : "注册并继续";
    }};

    form.addEventListener("submit", async (e) => {{
      e.preventDefault();
      setError("");
      setBusy(true);

      const email = document.getElementById("email").value.trim();
      const nickname = document.getElementById("nickname").value.trim();
      const password = document.getElementById("password").value;
      const next = nextInput.value || "/docs";

      try {{
        const response = await fetch("/api/v1/auth/register", {{
          method: "POST",
          headers: {{ "Content-Type": "application/json" }},
          body: JSON.stringify({{ email, nickname, password }}),
        }});

        const data = await response.json().catch(() => ({{}}));
        if (!response.ok) {{
          throw new Error(data.detail || "注册失败");
        }}

        const accessToken = data?.tokens?.access_token;
        const refreshToken = data?.tokens?.refresh_token;
        if (!accessToken || !refreshToken) {{
          throw new Error("注册响应缺少 token");
        }}

        document.cookie = "{ACCESS_TOKEN_COOKIE}=" + encodeURIComponent(accessToken) + "; Path=/; SameSite=Lax";
        document.cookie = "mini_auth_refresh_token=" + encodeURIComponent(refreshToken) + "; Path=/; SameSite=Lax";

        if (next) {{
          window.location.assign(next);
          return;
        }}
        window.location.assign("/docs");
      }} catch (err) {{
        setError(err instanceof Error ? err.message : "注册失败");
      }} finally {{
        setBusy(false);
      }}
    }});

    if (nextInput.value) {{
      nextHint.textContent = "Next: " + nextInput.value;
    }}
  </script>
</body>
</html>"""


@router.get("/login", response_class=HTMLResponse)
async def login_page(next: str = Query(default=""), error: str = Query(default=""), email: str = Query(default="")) -> str:
    return _login_page_html(next_url=next, error=error, email=email)


@router.get("/login/email", response_class=HTMLResponse)
async def email_login_page(
    next: str = Query(default=""),
    error: str = Query(default=""),
    email: str = Query(default=""),
) -> str:
    return _email_login_page_html(next_url=next, error=error, email=email)


@router.get("/register", response_class=HTMLResponse)
async def register_page(
    next: str = Query(default=""),
    error: str = Query(default=""),
    email: str = Query(default=""),
    nickname: str = Query(default=""),
) -> str:
    return _register_page_html(next_url=next, error=error, email=email, nickname=nickname)


@router.get("/logout")
async def logout(next: str = Query(default="")) -> Response:
    next_url = _normalized_next_url(next)
    if next_url:
        response: Response = RedirectResponse(url=next_url, status_code=302)
    else:
        response = Response(status_code=204)
    response.delete_cookie(ACCESS_TOKEN_COOKIE, path="/")
    response.delete_cookie("mini_auth_refresh_token", path="/")
    return response


@router.get("/oidc/demo", response_class=HTMLResponse)
async def oidc_demo(request: Request) -> str:
    redirect_uri = f"{_request_origin(request)}/oidc/demo/callback"
    next_url = (
        f"/oauth/authorize?response_type=code&client_id={quote(DEMO_CLIENT_ID)}"
        f"&redirect_uri={quote(redirect_uri, safe='')}"
        f"&scope=openid%20profile%20email&code_challenge_method=S256"
    )
    login_next = quote("/oidc/demo", safe="")
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>OIDC Demo</title>
  <style>
    body {{
      margin: 0;
      min-height: 100vh;
      font-family: "Avenir Next", "Segoe UI", "PingFang SC", sans-serif;
      background: linear-gradient(135deg, #f7f1e7, #eadccf);
      color: #23180f;
      display: grid;
      place-items: center;
      padding: 24px;
    }}
    .card {{
      width: min(720px, 100%);
      border-radius: 28px;
      padding: 32px;
      background: rgba(255,255,255,0.76);
      border: 1px solid rgba(72,53,32,0.12);
      box-shadow: 0 24px 70px rgba(55,39,24,0.16);
      backdrop-filter: blur(16px);
    }}
    h1 {{
      margin: 0 0 12px;
      font-family: "Iowan Old Style", Georgia, serif;
      font-size: clamp(36px, 5vw, 56px);
      letter-spacing: -0.04em;
    }}
    p {{ color: #6b5a49; line-height: 1.7; }}
    code {{
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      background: rgba(183,110,63,.12);
      color: #8b4d27;
    }}
    button, a.button {{
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 0;
      border-radius: 16px;
      padding: 14px 18px;
      margin-top: 20px;
      background: linear-gradient(180deg, #c97b49, #a45528);
      color: white;
      text-decoration: none;
      font-weight: 700;
      box-shadow: 0 18px 34px rgba(164,85,40,.25);
      cursor: pointer;
    }}
    .row {{ display: flex; gap: 12px; flex-wrap: wrap; }}
    .muted {{ color: #6b5a49; font-size: 14px; }}
    .pill {{
      display: inline-block;
      margin: 8px 8px 0 0;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(255,255,255,.7);
      border: 1px solid rgba(72,53,32,.1);
      font-size: 12px;
    }}
  </style>
</head>
<body>
  <main class="card">
    <h1>OIDC Demo</h1>
    <p>这个页面会用 PKCE 走一遍 <code>authorize → token → userinfo</code>。先登录，再点开始，就能看到整个流程闭环。</p>
    <div class="pill">client_id: {DEMO_CLIENT_ID}</div>
      <div class="pill">redirect_uri: {redirect_uri}</div>
    <div class="row">
      <button id="startBtn">Start OIDC Demo</button>
      <a class="button" href="/login?next={login_next}" id="loginLink">Go to login first</a>
    </div>
    <p class="muted" id="status">如果你还没登录，系统会先把你带到登录页。</p>
  </main>
  <script>
    const startBtn = document.getElementById("startBtn");
    const status = document.getElementById("status");

    const randomString = (length = 48) => {{
      const bytes = new Uint8Array(length);
      crypto.getRandomValues(bytes);
      return btoa(String.fromCharCode(...bytes))
        .replace(/[+]/g, "-")
        .replaceAll("/", "_")
        .replace(/=+$/g, "");
    }};

    const base64Url = (buffer) => {{
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return btoa(binary).replace(/[+]/g, "-").replaceAll("/", "_").replace(/=+$/g, "");
    }};

    const sha256 = async (plain) => {{
      const data = new TextEncoder().encode(plain);
      const digest = await crypto.subtle.digest("SHA-256", data);
      return base64Url(digest);
    }};

    startBtn.addEventListener("click", async () => {{
      startBtn.disabled = true;
      status.textContent = "Preparing PKCE...";
      const verifier = randomString(64);
      const challenge = await sha256(verifier);
      const state = randomString(16);
      sessionStorage.setItem(`oidc.pkce.${{state}}`, verifier);
      sessionStorage.setItem("oidc.demo.state", state);
      const authorizeUrl =
        "/oauth/authorize?response_type=code"
        + "&client_id={DEMO_CLIENT_ID}"
        + "&redirect_uri={quote(redirect_uri, safe='')}"
        + "&scope=openid%20profile%20email"
        + "&state=" + encodeURIComponent(state)
        + "&code_challenge=" + encodeURIComponent(challenge)
        + "&code_challenge_method=S256";
      window.location.assign(authorizeUrl);
    }});
  </script>
</body>
</html>"""


@router.get("/oidc/demo/callback", response_class=HTMLResponse)
async def oidc_demo_callback() -> str:
    return """<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>OIDC Callback</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      font-family: "Avenir Next", "Segoe UI", "PingFang SC", sans-serif;
      background: linear-gradient(135deg, #f7f1e7, #eadccf);
      color: #23180f;
      display: grid;
      place-items: center;
      padding: 24px;
    }
    .card {
      width: min(920px, 100%);
      border-radius: 28px;
      padding: 32px;
      background: rgba(255,255,255,0.78);
      border: 1px solid rgba(72,53,32,0.12);
      box-shadow: 0 24px 70px rgba(55,39,24,0.16);
      backdrop-filter: blur(16px);
    }
    h1 {
      margin: 0 0 12px;
      font-family: "Iowan Old Style", Georgia, serif;
      font-size: clamp(36px, 5vw, 56px);
      letter-spacing: -0.04em;
    }
    p, pre { line-height: 1.7; }
    pre {
      white-space: pre-wrap;
      word-break: break-word;
      padding: 18px;
      border-radius: 18px;
      background: #fff;
      border: 1px solid rgba(72,53,32,0.12);
      overflow: auto;
    }
    .row { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 18px; }
    a.button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 16px;
      padding: 14px 18px;
      background: linear-gradient(180deg, #c97b49, #a45528);
      color: white;
      text-decoration: none;
      font-weight: 700;
      box-shadow: 0 18px 34px rgba(164,85,40,.25);
    }
    .muted { color: #6b5a49; font-size: 14px; }
  </style>
</head>
<body>
  <main class="card">
    <h1>OIDC Callback</h1>
    <p class="muted">This page exchanges the authorization code for tokens, then fetches <code>/oauth/userinfo</code>.</p>
    <pre id="output">Loading...</pre>
    <div class="row">
      <a class="button" href="/oidc/demo">Back to demo</a>
      <a class="button" href="/login">Back to login</a>
    </div>
  </main>
  <script>
    const output = document.getElementById("output");

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const error = params.get("error");
    const errorDesc = params.get("error_description");

    const render = (value) => {{
      output.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
    }};

    if (error) {{
      render({{ error, error_description: errorDesc }});
    }} else if (!code) {{
      render("Missing authorization code.");
    }} else {{
      (async () => {{
        try {{
          const verifierKey = state ? `oidc.pkce.${{state}}` : "";
          const codeVerifier = verifierKey ? sessionStorage.getItem(verifierKey) : null;
          if (!codeVerifier) {{
            throw new Error("Missing PKCE code_verifier in sessionStorage.");
          }}

          const redirectUri = new URL("/oidc/demo/callback", window.location.origin).toString();
          const tokenRes = await fetch("/oauth/token", {{
            method: "POST",
            headers: {{ "Content-Type": "application/json" }},
            body: JSON.stringify({{
              grant_type: "authorization_code",
              code,
              redirect_uri: redirectUri,
              client_id: "minibot",
              code_verifier: codeVerifier,
            }}),
          }});
          const tokenData = await tokenRes.json();
          if (!tokenRes.ok) {{
            throw new Error(tokenData.detail || "Token exchange failed");
          }}

          const userinfoRes = await fetch("/oauth/userinfo", {{
            headers: {{ Authorization: `Bearer ${{tokenData.access_token}}` }},
          }});
          const userinfo = await userinfoRes.json();

          render({{
            tokens: tokenData,
            userinfo,
          }});
          if (verifierKey) {{
            sessionStorage.removeItem(verifierKey);
          }}
        }} catch (err) {{
          render({{ error: err instanceof Error ? err.message : String(err) }});
        }}
      }})();
    }}
  </script>
</body>
</html>"""
