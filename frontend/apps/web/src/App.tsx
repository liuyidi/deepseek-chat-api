import { useEffect, useState } from "react";
import { createWebAuthClient } from "./authClient";
import { WebLoginPage } from "./login/WebLoginPage";
import { SecurityCenterPage } from "./security-center/SecurityCenterPage";
import { createMockSecurityCenterDataSource } from "./security-center/mockDataSource";

export type AppRoute = "login" | "register" | "demo-login" | "security" | "security-redirect";

const securityCenterDataSource = createMockSecurityCenterDataSource();

export function resolveAppRoute(pathname: string): AppRoute {
  if (pathname === "/register" || pathname === "/register/") {
    return "register";
  }
  if (pathname === "/demo-login" || pathname === "/demo-login/") {
    return "demo-login";
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

function getNextUrl(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  if (next) {
    return next;
  }

  return new URL("/oidc/demo", window.location.origin).toString();
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
  const nextUrl = getNextUrl();
  const authClient = createWebAuthClient(getAuthBaseUrl());

  return (
    <WebLoginPage
      brand="Minibot"
      headline={mode === "register" ? "Create your Minibot account" : "Hey friend! Welcome back"}
      mode={mode}
      nextValue={nextUrl}
      googleLoginUrl={import.meta.env.VITE_GOOGLE_LOGIN_URL ?? ""}
      githubLoginUrl={import.meta.env.VITE_GITHUB_LOGIN_URL ?? ""}
      demoEmail="demo@mini-auth.dev"
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

  return <AuthRoute mode="login" />;
}
