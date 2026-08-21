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

function isDevPreview(): boolean {
  return import.meta.env.DEV && new URLSearchParams(window.location.search).get("preview") === "1";
}

const PREVIEW_USER = { email: "demo@mini-auth.dev", nickname: "demo" };

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

function LoadingSpinner() {
  return <span className="device-spinner" aria-hidden="true" />;
}

export function DevicePage() {
  const authClient = useMemo(() => createWebAuthClient(getAuthBaseUrl()), []);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [userCode, setUserCode] = useState(normalizeUserCode(parseUserCodeFromLocation()));
  const [request, setRequest] = useState<DeviceRequestSnapshot | null>(null);
  const [requestLoaded, setRequestLoaded] = useState(false);
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [approved, setApproved] = useState(false);
  const [completed, setCompleted] = useState(false);
  const agentParts = parseDeviceAgent(request?.user_agent);

  useEffect(() => {
    let cancelled = false;
    if (isDevPreview()) {
      setUser(PREVIEW_USER);
      setLoading(false);
      return;
    }
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
        setRequestLoaded(true);
        return;
      }
      try {
        const response = await fetch(`${getAuthBaseUrl().replace(/\/+$/, "")}/oauth/device/request?user_code=${encodeURIComponent(userCode)}`, {
          credentials: "include",
        });
        const data = (await response.json().catch(() => null)) as DeviceRequestSnapshot | null;
        if (!response.ok || !data || cancelled) {
          if (!cancelled) {
            setRequest(null);
            setRequestLoaded(true);
          }
          return;
        }
        setRequest(data);
        setRequestLoaded(true);
      } catch {
        if (!cancelled) {
          setRequest(null);
          setRequestLoaded(true);
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

  if (completed) {
    return (
      <main className="device-page">
        <section className="device-shell" aria-labelledby="device-title">
          <a className="device-brand" href="/" aria-label="Mini Auth">
            Mini Auth
          </a>

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
        <a className="device-brand" href="/" aria-label="Mini Auth">
          Mini Auth
        </a>

        <div className="device-copy">
          <p className="device-eyebrow">Sign in with device</p>
          <h1 id="device-title">Approve a login from your device</h1>
          <p className="device-description">
            Open this page on a browser, enter the code displayed on your device, then approve the request to continue.
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

        <div className="device-details" aria-label="Device information">
          {requestLoaded && request ? (
            <>
              <div className="device-detailRow">
                <span className="device-detailIcon" aria-hidden="true">
                  ⌘
                </span>
                <div className="device-detailBody">
                  <strong>{formatRequestTitle(request)}</strong>
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
                  <strong>{request.location || "Location unavailable"}</strong>
                  <span>{request.client_id || "Unknown client"}</span>
                </div>
              </div>
              <div className="device-detailRow">
                <span className="device-detailIcon" aria-hidden="true">
                  ◷
                </span>
                <div className="device-detailBody">
                  <strong>{formatTimestamp(request.created_at)}</strong>
                  <span>{request.scope}</span>
                </div>
              </div>
              <div className="device-detailRow">
                <span className="device-detailIcon" aria-hidden="true">
                  ⌬
                </span>
                <div className="device-detailBody">
                  <strong>{request.ip_address || "IP unavailable"}</strong>
                  <span>{request.verification_uri}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="device-emptyState" role="status">
              <strong>Waiting for device details</strong>
              <span>This device request has not been loaded yet.</span>
            </div>
          )}
        </div>

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
