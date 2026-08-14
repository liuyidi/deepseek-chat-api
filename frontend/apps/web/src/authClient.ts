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

export type CurrentUser = {
  email: string;
  nickname: string;
};

export type EmailCodeVerifyOptions = {
  username?: string;
};

export type DemoLoginOptions = {
  email: string;
  username: string;
};

const ACCESS_COOKIE = "mini_auth_access_token";
const REFRESH_COOKIE = "mini_auth_refresh_token";
const DEV_MOCK_EMAIL_CODE = "123456";

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function setSessionCookies(accessToken: string, refreshToken: string): void {
  document.cookie = `${ACCESS_COOKIE}=${encodeURIComponent(accessToken)}; Path=/; SameSite=Lax`;
  document.cookie = `${REFRESH_COOKIE}=${encodeURIComponent(refreshToken)}; Path=/; SameSite=Lax`;
}

function getCookieValue(name: string): string {
  const prefix = `${name}=`;
  const item = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : "";
}

function currentUserFromData(data: AuthResponse["user"] & AuthResponse): CurrentUser | null {
  if (!data?.email || !data?.nickname) {
    return null;
  }

  return {
    email: data.email,
    nickname: data.nickname,
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function shouldUseDevMockFallback(): boolean {
  if (import.meta.env.VITE_AUTH_MOCK === "true") {
    return true;
  }

  return (
    import.meta.env.DEV &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  );
}

function createDevMockAuthClient() {
  return {
    async getCurrentUser(): Promise<CurrentUser | null> {
      return null;
    },

    async startEmailLogin(email: string): Promise<EmailCodeStartResult> {
      return {
        email: normalizeEmail(email),
        expires_in: 300,
        resend_after_seconds: 3,
        debug_code: DEV_MOCK_EMAIL_CODE,
      };
    },

    async verifyEmailLogin(_email: string, code: string, _options?: EmailCodeVerifyOptions): Promise<void> {
      if (code.trim() !== DEV_MOCK_EMAIL_CODE) {
        throw new Error(`验证码错误，本地调试验证码是 ${DEV_MOCK_EMAIL_CODE}`);
      }

      setSessionCookies("mini-auth-dev-access-token", "mini-auth-dev-refresh-token");
    },

    async demoLogin(_options: DemoLoginOptions): Promise<void> {
      setSessionCookies("mini-auth-demo-access-token", "mini-auth-demo-refresh-token");
    },
  };
}

function shouldFallbackToDevMock(error: unknown): boolean {
  return shouldUseDevMockFallback() && error instanceof TypeError;
}

export function createWebAuthClient(baseUrl: string) {
  const devMockClient = createDevMockAuthClient();

  return {
    async getCurrentUser(): Promise<CurrentUser | null> {
      try {
        const response = await fetch(joinUrl(baseUrl, "/api/v1/users/me"), {
          credentials: "include",
        });

        if (response.status === 401 || response.status === 403) {
          const refreshToken = getCookieValue(REFRESH_COOKIE);

          const refreshResponse = await fetch(joinUrl(baseUrl, "/api/v1/auth/refresh"), {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(refreshToken ? { refresh_token: refreshToken } : {}),
          });
          const refreshData = (await refreshResponse.json().catch(() => ({}))) as AuthResponse["tokens"] &
            AuthResponse;
          if (!refreshResponse.ok || !refreshData.access_token || !refreshData.refresh_token) {
            return null;
          }
          if (refreshToken) {
            setSessionCookies(refreshData.access_token, refreshData.refresh_token);
          }

          const retryResponse = await fetch(joinUrl(baseUrl, "/api/v1/users/me"), {
            credentials: "include",
          });
          const retryData = (await retryResponse.json().catch(() => ({}))) as AuthResponse["user"] & AuthResponse;
          return retryResponse.ok ? currentUserFromData(retryData) : null;
        }

        const data = (await response.json().catch(() => ({}))) as AuthResponse["user"] & AuthResponse;
        if (!response.ok) {
          throw new Error(data.detail || "会话读取失败");
        }

        return currentUserFromData(data);
      } catch (error) {
        if (shouldFallbackToDevMock(error)) {
          return devMockClient.getCurrentUser();
        }

        return null;
      }
    },

    async startEmailLogin(email: string): Promise<EmailCodeStartResult> {
      try {
        const response = await fetch(joinUrl(baseUrl, "/api/v1/auth/email/start"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: normalizeEmail(email) }),
        });

        const data = (await response.json().catch(() => ({}))) as EmailCodeStartResult & AuthResponse;
        if (!response.ok) {
          throw new Error((data as AuthResponse).detail || "发送验证码失败，请稍后重试");
        }

        return data;
      } catch (error) {
        if (shouldFallbackToDevMock(error)) {
          return devMockClient.startEmailLogin(email);
        }

        throw error;
      }
    },

    async verifyEmailLogin(email: string, code: string, options?: EmailCodeVerifyOptions): Promise<void> {
      const nickname = options?.username?.trim();
      try {
        const response = await fetch(joinUrl(baseUrl, "/api/v1/auth/email/verify"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: normalizeEmail(email),
            code,
            ...(nickname ? { nickname } : {}),
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
      } catch (error) {
        if (shouldFallbackToDevMock(error)) {
          return devMockClient.verifyEmailLogin(email, code, options);
        }

        throw error;
      }
    },

    async demoLogin(options: DemoLoginOptions): Promise<void> {
      try {
        const response = await fetch(joinUrl(baseUrl, "/api/v1/auth/demo-login"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: normalizeEmail(options.email),
            nickname: options.username.trim(),
          }),
        });

        const data = (await response.json().catch(() => ({}))) as AuthResponse;
        if (!response.ok) {
          throw new Error(data.detail || "Demo login failed. Please try again.");
        }

        const accessToken = data.tokens?.access_token;
        const refreshToken = data.tokens?.refresh_token;
        if (!accessToken || !refreshToken) {
          throw new Error("Demo login response is missing tokens");
        }

        setSessionCookies(accessToken, refreshToken);
      } catch (error) {
        if (shouldFallbackToDevMock(error)) {
          return devMockClient.demoLogin(options);
        }

        throw error;
      }
    },
  };
}
