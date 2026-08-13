import { useEffect, useMemo, useState, type FormEvent } from "react";

import "./login-page.css";

export type EmailCodeStartResult = {
  email: string;
  expires_in: number;
  resend_after_seconds: number;
  debug_code?: string | null;
};

export type LoginPageProps = {
  brand: string;
  headline: string;
  subtitle: string;
  description: string;
  nextValue?: string;
  googleLoginUrl?: string;
  googleButtonLabel?: string;
  emailButtonLabel?: string;
  demoEmail?: string;
  onSendCode: (email: string) => Promise<EmailCodeStartResult>;
  onVerifyCode: (email: string, code: string) => Promise<void>;
};

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function GoogleMark() {
  return (
    <span className="auth-google-mark" aria-hidden="true">
      <span className="auth-google-mark__ring" />
      <span className="auth-google-mark__g">G</span>
    </span>
  );
}

export function LoginPage({
  brand,
  headline,
  subtitle,
  description,
  nextValue = "",
  googleLoginUrl,
  googleButtonLabel = "Google 登录",
  emailButtonLabel = "发送验证码",
  demoEmail = "",
  onSendCode,
  onVerifyCode,
}: LoginPageProps) {
  const [email, setEmail] = useState(demoEmail);
  const [code, setCode] = useState("");
  const [sentEmail, setSentEmail] = useState("");
  const [debugCode, setDebugCode] = useState("");
  const [error, setError] = useState("");
  const [loadingSend, setLoadingSend] = useState(false);
  const [loadingVerify, setLoadingVerify] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const isDevelopment = import.meta.env.DEV;

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const bulletPoints = useMemo(() => ["简单快捷", "安全验证", "自动继续"], []);

  const canResend = cooldown === 0 && !loadingSend;

  const handleSendCode = async () => {
    const normalized = normalizeEmail(email);
    if (!normalized) {
      setError("请先输入邮箱");
      return;
    }

    setError("");
    setLoadingSend(true);
    try {
      const result = await onSendCode(normalized);
      setSentEmail(result.email || normalized);
      setDebugCode(result.debug_code || "");
      setCooldown(result.resend_after_seconds || 60);
      if (result.debug_code) {
        setCode(result.debug_code);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送验证码失败，请稍后重试。");
    } finally {
      setLoadingSend(false);
    }
  };

  const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = normalizeEmail(email);
    if (!normalized || !code.trim()) {
      setError("请先输入邮箱和验证码");
      return;
    }

    setError("");
    setLoadingVerify(true);
    try {
      await onVerifyCode(normalized, code.trim());
      window.location.assign(nextValue || "/docs");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败，请稍后重试。");
    } finally {
      setLoadingVerify(false);
    }
  };

  return (
    <main className="auth-page">
      <header className="auth-topbar">
        <a className="auth-topbar__brand" href="/">
          <span className="auth-topbar__mark">∞</span>
          <span>{brand}</span>
        </a>
        <span className="auth-topbar__note">登录与验证</span>
      </header>

      <section className="auth-stage">
        <div className="auth-hero">
          <h1 className="auth-hero__title">
            <span>{headline}</span>
            <span className="auth-hero__party" aria-hidden="true">
              🎉
            </span>
          </h1>
          <p className="auth-lead">{subtitle}</p>
          <p className="auth-copy">{description}</p>

          <ul className="auth-bullets">
            {bulletPoints.map((item) => (
              <li key={item}>
                <span className="auth-check">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <section className="auth-card">
          <div className="auth-card__header">
            <div>
              <div className="auth-card__title">{brand}</div>
              <div className="auth-card__meta">登录后将自动继续</div>
            </div>
          </div>

          {error ? <div className="auth-alert">{error}</div> : null}

          {googleLoginUrl ? (
            <a className="auth-button auth-button--google" href={googleLoginUrl}>
              <GoogleMark />
              <span>{googleButtonLabel}</span>
            </a>
          ) : (
            <button className="auth-button auth-button--google" type="button" disabled>
              <GoogleMark />
              <span>{googleButtonLabel}</span>
            </button>
          )}

          <div className="auth-divider">
            <span>或</span>
          </div>

          <div className="auth-email">
            <div className="auth-email__heading">
              {sentEmail ? "验证码已发送至你的邮箱" : "输入邮箱开始登录"}
            </div>
            {sentEmail ? <div className="auth-email__address">{sentEmail}</div> : null}

            <div className="auth-email__actions">
              <label className="auth-field">
                <span>邮箱</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </label>

              <button
                className="auth-button auth-button--ghost"
                type="button"
                onClick={handleSendCode}
                disabled={!canResend}
              >
                {loadingSend
                  ? "发送中..."
                  : cooldown > 0
                    ? `重新发送 (${cooldown}s)`
                    : emailButtonLabel}
              </button>
            </div>

            <form className="auth-form" onSubmit={handleVerify}>
              <label className="auth-field">
                <span>验证码</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="输入 6 位验证码"
                />
              </label>

              <div className="auth-row">
                <button
                  className="auth-button auth-button--secondary"
                  type="button"
                  onClick={() => {
                    setEmail("");
                    setCode("");
                    setSentEmail("");
                    setDebugCode("");
                    setError("");
                  }}
                >
                  返回
                </button>
                <button className="auth-button auth-button--primary" type="submit" disabled={loadingVerify}>
                  {loadingVerify ? "验证中..." : "验证并继续"}
                </button>
              </div>
            </form>

            {debugCode && isDevelopment ? <div className="auth-debug">调试验证码：{debugCode}</div> : null}
          </div>
        </section>
      </section>

      <footer className="auth-footer" aria-label="备案信息">
        <span className="auth-footer__label">备案信息</span>
        <div className="auth-footer__items">
          <a
            href="https://beian.miit.gov.cn/"
            target="_blank"
            rel="noreferrer"
            className="auth-footer__link"
          >
            浙ICP备2026062548号-1
          </a>
          <span className="auth-footer__copy">© 2026 Minibot. All rights reserved.</span>
        </div>
      </footer>
    </main>
  );
}
