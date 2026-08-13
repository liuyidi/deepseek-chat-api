import type { EmailCodeStartResult } from "@mini-auth/auth-ui";

type AuthResponse = {
  user?: {
    email?: string;
    nickname?: string;
  };
  tokens?: {
    access_token?: string;
    refresh_token?: string;
  };
  detail?: string;
};

const ACCESS_COOKIE = "mini_auth_access_token";
const REFRESH_COOKIE = "mini_auth_refresh_token";

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function setSessionCookies(accessToken: string, refreshToken: string): void {
  document.cookie = `${ACCESS_COOKIE}=${encodeURIComponent(accessToken)}; Path=/; SameSite=Lax`;
  document.cookie = `${REFRESH_COOKIE}=${encodeURIComponent(refreshToken)}; Path=/; SameSite=Lax`;
}

export function createWebAuthClient(baseUrl: string) {
  return {
    async startEmailLogin(email: string): Promise<EmailCodeStartResult> {
      const response = await fetch(joinUrl(baseUrl, "/api/v1/auth/email/start"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = (await response.json().catch(() => ({}))) as EmailCodeStartResult & AuthResponse;
      if (!response.ok) {
        throw new Error((data as AuthResponse).detail || "发送验证码失败，请稍后重试");
      }

      return data;
    },

    async verifyEmailLogin(email: string, code: string): Promise<void> {
      const response = await fetch(joinUrl(baseUrl, "/api/v1/auth/email/verify"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as AuthResponse;
      if (!response.ok) {
        throw new Error(data.detail || "登录失败，请稍后重试");
      }

      const accessToken = data.tokens?.access_token;
      const refreshToken = data.tokens?.refresh_token;
      if (!accessToken || !refreshToken) {
        throw new Error("登录响应缺少 token");
      }

      setSessionCookies(accessToken, refreshToken);
    },
  };
}
