import { useEffect, useMemo, useState } from "react";

import { createWebAuthClient, type CurrentUser } from "../authClient";
import "./SelectAccountPage.css";

export function buildAuthorizeContinueUrl(search: string): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  params.delete("account_confirmed");
  params.set("account_confirmed", "1");
  const query = params.toString();
  return query ? `/oauth/authorize?${query}` : "/oauth/authorize?account_confirmed=1";
}

export function buildSwitchAccountLogoutUrl(search: string): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  params.delete("account_confirmed");
  const authorizeQuery = params.toString();
  const authorizePath = authorizeQuery ? `/oauth/authorize?${authorizeQuery}` : "/oauth/authorize";
  const loginNext = `/login?next=${encodeURIComponent(authorizePath)}`;
  return `/logout?next=${encodeURIComponent(loginNext)}`;
}

export function readAuthorizeClientId(search: string): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return (params.get("client_id") || "").trim();
}

function avatarInitial(nickname: string): string {
  const trimmed = nickname.trim();
  return trimmed ? trimmed[0]!.toUpperCase() : "?";
}

function isDevPreview(): boolean {
  return import.meta.env.DEV && new URLSearchParams(window.location.search).get("preview") === "1";
}

const PREVIEW_USER: CurrentUser = { email: "demo@mini-auth.dev", nickname: "demo" };

export function SelectAccountPage({
  authBaseUrl,
  search = typeof window !== "undefined" ? window.location.search : "",
}: {
  authBaseUrl: string;
  search?: string;
}) {
  const authClient = useMemo(() => createWebAuthClient(authBaseUrl), [authBaseUrl]);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const clientId = useMemo(() => readAuthorizeClientId(search), [search]);

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
        const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
        params.delete("account_confirmed");
        const authorizeQuery = params.toString();
        const authorizePath = authorizeQuery ? `/oauth/authorize?${authorizeQuery}` : "/oauth/authorize";
        window.location.replace(`/login?next=${encodeURIComponent(authorizePath)}`);
        return;
      }
      setUser(current);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [authClient, search]);

  if (loading || !user) {
    return null;
  }

  const continueUrl = buildAuthorizeContinueUrl(search);
  const switchUrl = buildSwitchAccountLogoutUrl(search);

  return (
    <main className="select-account-page">
      <section className="select-account-panel" aria-labelledby="select-account-title">
        <a className="select-account-brand" href="/" aria-label="Mini Auth">
          Mini Auth
        </a>
        <h1 id="select-account-title">继续以该账号登录</h1>
        {clientId ? (
          <p className="select-account-context">正在授权 · {clientId}</p>
        ) : null}

        <div className="select-account-user" aria-label="当前账号">
          <span className="select-account-avatar" aria-hidden>
            {avatarInitial(user.nickname)}
          </span>
          <span className="select-account-user-text">
            <span className="select-account-nickname">{user.nickname}</span>
            <span className="select-account-email">{user.email}</span>
          </span>
        </div>

        <div className="select-account-actions">
          <a className="select-account-continue" href={continueUrl}>
            以 {user.nickname} 继续
          </a>
          <a className="select-account-switch" href={switchUrl}>
            使用其他账号
          </a>
        </div>
      </section>
    </main>
  );
}
