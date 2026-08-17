import { useEffect, useMemo, useState } from "react";
import { createWebAuthClient } from "./authClient";
import { WebLoginPage } from "./login/WebLoginPage";
import { SecurityCenterPage } from "./security-center/SecurityCenterPage";
import { createMockSecurityCenterDataSource } from "./security-center/mockDataSource";
import { SelectAccountPage } from "./select-account/SelectAccountPage";

export type AppRoute =
  | "login"
  | "register"
  | "demo-login"
  | "security"
  | "security-redirect"
  | "select-account";

const securityCenterDataSource = createMockSecurityCenterDataSource();

export function resolveAppRoute(pathname: string): AppRoute {
  if (pathname === "/register" || pathname === "/register/") {
    return "register";
  }
  if (pathname === "/demo-login" || pathname === "/demo-login/") {
    return "demo-login";
  }
  if (pathname === "/oauth/select-account" || pathname === "/oauth/select-account/") {
    return "select-account";
  }
  if (pathname === "/accounts" || pathname === "/accounts/") {
    return "security-redirect";
  }
  if (pathname === "/accounts/security" || pathname === "/accounts/security/") {
    return "security";
  }
  return "login";
}

function getAuthBaseUrl(): string {
  const configured = import.meta.env.VITE_AUTH_BASE_URL?.trim();
  if (configured) {
    return configured;
  }

  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return "http://127.0.0.1:8000";
  }

  return window.location.origin;
}

function getBotBaseUrl(): string {
  const configured = import.meta.env.VITE_BOT_BASE_URL?.trim();
  if (configured) {
    return configured;
  }

  return "https://bot.liuyidi.me";
}

export function createExternalLoginUrl(baseUrl: string, provider: "github", nextUrl: string): string {
  const params = new URLSearchParams({ next: nextUrl });
  return `${baseUrl.replace(/\/+$/, "")}/api/v1/auth/${provider}/start?${params.toString()}`;
}

export function getNextUrl(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  if (next) {
    return next;
  }

  if (window.location.hostname === "auth.liuyidi.me") {
    return "https://bot.liuyidi.me/";
  }

  return "/accounts/security/";
}

function getLoginRedirectTarget(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  if (next) {
    return next;
  }

  if (window.location.hostname === "auth.liuyidi.me") {
    return "https://bot.liuyidi.me/";
  }

  return getNextUrl();
}

function createDemoLoginHref(nextUrl: string): string {
  const params = new URLSearchParams();
  if (nextUrl) {
    params.set("next", nextUrl);
  }

  const query = params.toString();
  return query ? `/demo-login?${query}` : "/demo-login";
}

function AuthRoute({ mode }: { mode: "login" | "register" }) {
  const [checkingSession, setCheckingSession] = useState(true);
  const nextUrl = getLoginRedirectTarget();
  const authClient = useMemo(() => createWebAuthClient(getAuthBaseUrl()), []);

  useEffect(() => {
    let cancelled = false;
    const maybeRedirectToBot = async () => {
      if (window.location.hostname !== "auth.liuyidi.me") {
        return null;
      }

      try {
        const response = await fetch(`${getBotBaseUrl()}/auth/config`, {
          credentials: "include",
        });
        if (!response.ok) {
          return null;
        }

        const data = (await response.json().catch(() => ({}))) as { authenticated?: boolean };
        return data.authenticated ? "https://bot.liuyidi.me/" : null;
      } catch {
        return null;
      }
    };

    void authClient.getCurrentUser().then(async (user) => {
      if (cancelled) return;
      if (user) {
        window.location.replace(nextUrl);
        return;
      }

      const botTarget = await maybeRedirectToBot();
      if (cancelled) return;
      if (botTarget) {
        window.location.replace(botTarget);
        return;
      }

      setCheckingSession(false);
    });
    return () => {
      cancelled = true;
    };
  }, [authClient, nextUrl]);

  if (checkingSession) {
    return null;
  }

  return (
    <WebLoginPage
      brand="Minibot"
      headline={mode === "register" ? "Create your Minibot account" : "Hey friend! Welcome back"}
      mode={mode}
      nextValue={nextUrl}
      googleLoginUrl={import.meta.env.VITE_GOOGLE_LOGIN_URL ?? ""}
      githubLoginUrl={
        import.meta.env.VITE_GITHUB_LOGIN_ENABLED === "true"
          ? createExternalLoginUrl(getAuthBaseUrl(), "github", nextUrl)
          : ""
      }
      demoLoginHref={mode === "login" ? createDemoLoginHref(nextUrl) : undefined}
      onSendCode={async (email) => {
        return authClient.startEmailLogin(email);
      }}
      onVerifyCode={async (email, code, options) => {
        await authClient.verifyEmailLogin(email, code, options);
      }}
    />
  );
}

function DemoLoginRoute() {
  const [error, setError] = useState("");

  useEffect(() => {
    const authClient = createWebAuthClient(getAuthBaseUrl());
    void authClient
      .demoLogin({
        email: "demo@mini-auth.dev",
        username: "demo",
      })
      .then(() => {
        window.location.assign(getNextUrl());
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Demo login failed. Please try again.");
      });
  }, []);

  return (
    <main className="mini-login-page">
      <section className="mini-login-panel" aria-labelledby="mini-login-title">
        <a className="mini-login-brand" href="/" aria-label="Minibot">
          Minibot
        </a>
        <h1 id="mini-login-title">Demo login</h1>
        {error ? (
          <div className="mini-login-error">{error}</div>
        ) : (
          <p className="mini-login-resend">Signing in as demo@mini-auth.dev...</p>
        )}
      </section>
    </main>
  );
}

export default function App() {
  const route = resolveAppRoute(window.location.pathname);

  if (route === "security-redirect") {
    window.location.replace("/accounts/security/");
    return null;
  }

  if (route === "security") {
    return <SecurityCenterPage dataSource={securityCenterDataSource} />;
  }

  if (route === "register") {
    return <AuthRoute mode="register" />;
  }

  if (route === "demo-login") {
    return <DemoLoginRoute />;
  }

  if (route === "select-account") {
    return <SelectAccountPage authBaseUrl={getAuthBaseUrl()} />;
  }

  return <AuthRoute mode="login" />;
}
