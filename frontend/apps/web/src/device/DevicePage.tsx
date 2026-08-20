import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createWebAuthClient, type CurrentUser } from "../authClient";
import "./device-page.css";

type DeviceRequestSnapshot = {
  user_code: string;
  client_id: string;
  scope: string;
  verification_uri: string;
  device_label: string;
  location?: string | null;
  created_at: string;
  ip_address?: string | null;
  user_agent?: string | null;
  status: string;
  approved_user?: string | null;
  approved_at?: string | null;
};

type DeviceAgentParts = {
  host: string;
  cli: string;
  node: string;
  platform: string;
  arch: string;
};

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

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatRequestTitle(snapshot: DeviceRequestSnapshot): string {
  if (snapshot.device_label) {
    return snapshot.device_label;
  }
  return "Unknown device";
}

function parseDeviceAgent(value?: string | null): DeviceAgentParts | null {
  const raw = (value || "").trim();
  if (!raw) return null;

  const atSplit = raw.split(" @ ", 2);
  const host = atSplit[0] || "Unknown host";
  const tail = atSplit[1] || "";
  const match = tail.match(/^([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+\((.+)\)$/);
  if (!match) {
    return { host, cli: tail || "Unknown CLI", node: "", platform: "", arch: "" };
  }

  const [cli, version, node, platformArch] = [match[1], match[2], match[3], match[4]];
  const archMatch = platformArch.match(/^(.*)\s+([^)]+)$/);
  const platform = archMatch ? archMatch[1] : platformArch;
  const arch = archMatch ? archMatch[2] : "";

  return {
    host,
    cli: `${cli} ${version}`.trim(),
    node,
    platform,
    arch,
  };
}

export function buildDeviceVerificationUrl(userCode: string): string {
  const params = new URLSearchParams();
  const normalized = normalizeUserCode(userCode);
  if (normalized) params.set("user_code", normalized);
  const query = params.toString();
  return query ? `/oauth/device?${query}` : "/oauth/device";
}

function splitDeviceCode(code: string): string[] {
  const normalized = normalizeUserCode(code).replace(/[^A-Z0-9]/g, "");
  const first = normalized.slice(0, 4);
  const second = normalized.slice(4, 8);
  return [first, second].filter(Boolean);
}

function MiniAuthLogo() {
  return (
    <span className="device-brandMark" aria-hidden="true">
      <svg viewBox="0 0 40 40" focusable="false">
        <path d="M20 3.5 34 9v9.2c0 8.8-5.9 15.2-14 18.3C11.9 33.4 6 27 6 18.2V9l14-5.5Z" fill="currentColor" opacity=".12" />
        <path d="M20 7.8 30 11.7v6.4c0 6.3-3.9 11.1-10 14-6.1-2.9-10-7.7-10-14v-6.4l10-3.9Z" fill="none" stroke="currentColor" strokeWidth="3" />
      </svg>
    </span>
  );
}

function IdentityAvatar() {
  return (
    <span className="device-identityMark" aria-hidden="true">
      <svg viewBox="0 0 40 40" focusable="false">
        <circle cx="20" cy="20" r="20" fill="#93c5fd" />
        <path d="M12 18.5 20 8l8 10.5-1.4 4.4-1.8 7.1H15.2l-1.8-7.1L12 18.5Z" fill="#1f2937" />
        <path d="M14.5 18c1.9-4.2 4-6.1 5.5-6.1s3.6 1.9 5.5 6.1" fill="none" stroke="#111827" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M14.2 21.2c1.7 3 3.9 4.4 5.8 4.4s4.1-1.4 5.8-4.4" fill="none" stroke="#111827" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function LoadingSpinner() {
  return <span className="device-spinner" aria-hidden="true" />;
}

export function DevicePage() {
  const authClient = useMemo(() => createWebAuthClient(getAuthBaseUrl()), []);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [userCode, setUserCode] = useState(normalizeUserCode(parseUserCodeFromLocation()));
  const [request, setRequest] = useState<DeviceRequestSnapshot | null>(null);
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [approved, setApproved] = useState(false);
  const [completed, setCompleted] = useState(false);
  const agentParts = parseDeviceAgent(request?.user_agent);

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
    let cancelled = false;
    async function loadRequest() {
      if (!userCode) {
        setRequest(null);
        return;
      }
      try {
        const response = await fetch(`${getAuthBaseUrl().replace(/\/+$/, "")}/oauth/device/request?user_code=${encodeURIComponent(userCode)}`, {
          credentials: "include",
        });
        const data = (await response.json().catch(() => null)) as DeviceRequestSnapshot | null;
        if (!response.ok || !data || cancelled) {
          return;
        }
        setRequest(data);
      } catch {
        if (!cancelled) {
          setRequest(null);
        }
      }
    }
    void loadRequest();
    return () => {
      cancelled = true;
    };
  }, [userCode]);

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

  const codeGroups = splitDeviceCode(userCode);

  return (
    <main className="device-page">
      <section className="device-shell" aria-labelledby="device-title">
        <header className="device-brand">
          <MiniAuthLogo />
          <span>MINI-AUTH</span>
        </header>

        <div className="device-hero">
          <div className="device-markRow" aria-hidden="true">
            <MiniAuthLogo />
            <span className="device-bridge">↔</span>
            <IdentityAvatar />
          </div>

          <p className="device-eyebrow">SIGN IN WITH DEVICE</p>
          <h1 id="device-title">{completed ? "Approval complete" : "Approve a login from your device"}</h1>
          <p className="device-description">
            {completed
              ? "The request has been approved. Return to the waiting device and it will complete sign-in automatically."
              : "Open this page in a browser, enter the code displayed on your device, then approve the request to continue."}
          </p>
        </div>

        {!completed ? (
          <form className="device-form" onSubmit={onSubmit}>
            <label className="device-field">
              <span>Device code</span>
              <input
                value={userCode}
                onChange={(event) => {
                  setUserCode(normalizeUserCode(event.target.value));
                  setApproved(false);
                }}
                placeholder="XRTG-PMDM"
                autoComplete="off"
                spellCheck={false}
                inputMode="text"
              />
            </label>

            <div className="device-codeDisplay" aria-label="Device code preview">
              {codeGroups.length > 0 ? (
                codeGroups.map((group, index) => (
                  <span key={`${group}-${index}`} className="device-codeChip">
                    {group}
                  </span>
                ))
              ) : (
                <span className="device-codeHint">- - - - - - - -</span>
              )}
            </div>

            {error ? (
              <div className="device-error" role="alert">
                {error}
              </div>
            ) : null}
            {status ? <div className="device-status">{status}</div> : null}

            <button className="device-continue" type="submit" disabled={submitting || approved}>
              {submitting ? (
                <span className="device-continueContent">
                  <LoadingSpinner />
                  <span>Allowing...</span>
                </span>
              ) : approved ? (
                "Approved"
              ) : (
                "Allow"
              )}
            </button>
          </form>
        ) : (
          <div className="device-complete" role="status">
            <div className="device-account">
              <strong>{user.nickname}</strong>
              <span>{user.email}</span>
            </div>
            <p className="device-successCopy">You can close this tab and return to the waiting device.</p>
          </div>
        )}

        <div className="device-details" aria-label="Device information">
          <div className="device-detailRow">
            <span className="device-detailIcon" aria-hidden="true">
              ⌘
            </span>
            <div className="device-detailBody">
              <strong>{request ? formatRequestTitle(request) : "Loading device info..."}</strong>
              {agentParts ? (
                <>
                  <span>{agentParts.cli}</span>
                  {agentParts.node ? <span>{agentParts.node}</span> : null}
                  {agentParts.platform || agentParts.arch ? (
                    <span>
                      {agentParts.platform}
                      {agentParts.arch ? ` (${agentParts.arch})` : ""}
                    </span>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
          <div className="device-detailRow">
            <span className="device-detailIcon" aria-hidden="true">
              ⌖
            </span>
            <div className="device-detailBody">
              <strong>{request?.location || "Location unavailable"}</strong>
              <span>{request?.client_id || "Unknown client"}</span>
            </div>
          </div>
          <div className="device-detailRow">
            <span className="device-detailIcon" aria-hidden="true">
              ◷
            </span>
            <div className="device-detailBody">
              <strong>{request ? formatTimestamp(request.created_at) : "Loading time..."}</strong>
              <span>{request?.scope || "Loading scope..."}</span>
            </div>
          </div>
          <div className="device-detailRow">
            <span className="device-detailIcon" aria-hidden="true">
              ⌬
            </span>
            <div className="device-detailBody">
              <strong>{request?.ip_address || "IP unavailable"}</strong>
              <span>{request?.verification_uri || "Verification URI unavailable"}</span>
            </div>
          </div>
        </div>

        {!completed ? (
          <div className="device-warning">
            <span className="device-warningIcon" aria-hidden="true">
              i
            </span>
            <p>
              Do not click "Allow" unless you initiated this login attempt from <strong>Vercel CLI</strong>
            </p>
          </div>
        ) : null}

        <footer className="device-footer">
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy Policy</a>
        </footer>
      </section>
    </main>
  );
}
