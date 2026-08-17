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

function avatarInitial(nickname: string): string {
  const trimmed = nickname.trim();
  return trimmed ? trimmed[0]!.toUpperCase() : "?";
}

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

  useEffect(() => {
    let cancelled = false;
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
      <section className="select-account-card" aria-labelledby="select-account-title">
        <h1 id="select-account-title">选择账号</h1>
        <a className="select-account-user" href={continueUrl}>
          <span className="select-account-avatar" aria-hidden>
            {avatarInitial(user.nickname)}
          </span>
          <span className="select-account-user-text">
            <span className="select-account-nickname">{user.nickname}</span>
            <span className="select-account-plan">个人版</span>
          </span>
        </a>
        <a className="select-account-switch" href={switchUrl}>
          切换登录用户
        </a>
      </section>
    </main>
  );
}
