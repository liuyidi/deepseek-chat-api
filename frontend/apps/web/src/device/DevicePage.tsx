import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createWebAuthClient, type CurrentUser } from "../authClient";
import "./device-page.css";

function getAuthBaseUrl(): string {
  const configured = import.meta.env.VITE_AUTH_BASE_URL?.trim();
  if (configured) return configured;
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return "http://127.0.0.1:8000";
  }
  return window.location.origin;
}

function normalizeUserCode(value: string): string {
  return value.trim().toUpperCase();
}

function parseUserCodeFromLocation(): string {
  return new URLSearchParams(window.location.search).get("user_code") || "";
}

export function buildDeviceVerificationUrl(userCode: string): string {
  const params = new URLSearchParams();
  const normalized = normalizeUserCode(userCode);
  if (normalized) params.set("user_code", normalized);
  const query = params.toString();
  return query ? `/oauth/device?${query}` : "/oauth/device";
}

export function DevicePage() {
  const authClient = useMemo(() => createWebAuthClient(getAuthBaseUrl()), []);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [userCode, setUserCode] = useState(normalizeUserCode(parseUserCodeFromLocation()));
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [approved, setApproved] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void authClient.getCurrentUser().then((current) => {
      if (cancelled) return;
      if (!current) {
        window.location.replace(`/login?next=${encodeURIComponent(buildDeviceVerificationUrl(userCode))}`);
        return;
      }
      setUser(current);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [authClient, userCode]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = normalizeUserCode(params.get("user_code") || "");
    if (code && code !== userCode) {
      setUserCode(code);
    }
  }, [userCode]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = normalizeUserCode(userCode);
    if (!normalized) {
      setError("请输入设备码。");
      return;
    }

    setSubmitting(true);
    setError("");
    setStatus("正在确认...");
    try {
      const response = await fetch(`${getAuthBaseUrl().replace(/\/+$/, "")}/oauth/device/confirm`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user_code: normalized, approve: true }),
      });
      const data = (await response.json().catch(() => ({}))) as { detail?: string; status?: string };
      if (!response.ok) {
        throw new Error(data.detail || "确认失败，请稍后重试");
      }
      setApproved(true);
      setCompleted(true);
      setStatus(data.status === "approved" ? "已确认，可返回设备继续登录" : "已提交");
    } catch (err) {
      setError(err instanceof Error ? err.message : "确认失败，请稍后重试");
      setStatus("");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !user) {
    return null;
  }

  if (completed) {
    return (
      <main className="device-page">
        <section className="device-shell" aria-labelledby="device-title">
          <div className="device-brand">
            <span className="device-mark" aria-hidden="true">
              <svg viewBox="0 0 40 40" focusable="false">
                <path d="M20 3.5 34 9v9.2c0 8.8-5.9 15.2-14 18.3C11.9 33.4 6 27 6 18.2V9l14-5.5Z" fill="currentColor" opacity=".14" />
                <path d="M20 7.8 30 11.7v6.4c0 6.3-3.9 11.1-10 14-6.1-2.9-10-7.7-10-14v-6.4l10-3.9Z" fill="none" stroke="currentColor" strokeWidth="3" />
              </svg>
            </span>
            <span>mini-auth</span>
          </div>

          <div className="device-copy">
            <p className="device-eyebrow">Device approved</p>
            <h1 id="device-title">You can return to your device now</h1>
            <p className="device-description">
              The login request has been approved. Your waiting device should finish signing in automatically.
            </p>
          </div>

          <div className="device-status">Approved for {user.nickname}</div>
        </section>
      </main>
    );
  }

  return (
    <main className="device-page">
      <section className="device-shell" aria-labelledby="device-title">
        <div className="device-brand">
          <span className="device-mark" aria-hidden="true">
            <svg viewBox="0 0 40 40" focusable="false">
              <path d="M20 3.5 34 9v9.2c0 8.8-5.9 15.2-14 18.3C11.9 33.4 6 27 6 18.2V9l14-5.5Z" fill="currentColor" opacity=".14" />
              <path d="M20 7.8 30 11.7v6.4c0 6.3-3.9 11.1-10 14-6.1-2.9-10-7.7-10-14v-6.4l10-3.9Z" fill="none" stroke="currentColor" strokeWidth="3" />
            </svg>
          </span>
          <span>mini-auth</span>
        </div>

        <div className="device-copy">
          <p className="device-eyebrow">Sign in with device</p>
          <h1 id="device-title">Approve a login from your device</h1>
          <p className="device-description">
            Open this page on a browser, enter the code displayed on your device, then approve the request
            to continue.
          </p>
        </div>

        <form className="device-form" onSubmit={onSubmit}>
          <label className="device-field">
            <span>Device code</span>
            <input
              value={userCode}
              onChange={(event) => {
                setUserCode(normalizeUserCode(event.target.value));
                setApproved(false);
              }}
              placeholder="LCKR-JRGX"
              autoComplete="off"
              spellCheck={false}
            />
          </label>

          {error ? <div className="device-error" role="alert">{error}</div> : null}
          {status ? <div className="device-status">{status}</div> : null}

          <button className="device-continue" type="submit" disabled={submitting || approved}>
            {approved ? "Approved" : submitting ? "Confirming..." : "Continue"}
          </button>
        </form>

        <div className="device-footer">
          <div>
            <strong>{user.nickname}</strong>
            <span>{user.email}</span>
          </div>
          <p>After approval, return to the waiting device and it will complete sign-in automatically.</p>
        </div>
      </section>
    </main>
  );
}
