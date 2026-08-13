import { LoginPage } from "@mini-auth/auth-ui";
import { createWebAuthClient } from "./authClient";

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

export default function App() {
  const nextUrl = getNextUrl();
  const authClient = createWebAuthClient(getAuthBaseUrl());

  return (
    <LoginPage
      brand="Minibot"
      headline="欢迎来到Minibot"
      subtitle="登录即可继续。"
      description="选择你喜欢的方式登录，完成后会自动进入下一步。"
      nextValue={nextUrl}
      googleLoginUrl={import.meta.env.VITE_GOOGLE_LOGIN_URL ?? ""}
      demoEmail="demo@mini-auth.dev"
      onSendCode={async (email) => {
        return authClient.startEmailLogin(email);
      }}
      onVerifyCode={async (email, code) => {
        await authClient.verifyEmailLogin(email, code);
      }}
    />
  );
}
