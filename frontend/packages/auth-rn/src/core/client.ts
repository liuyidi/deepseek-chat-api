import { AuthSdkError, readFastApiError } from "./errors";
import { buildAuthorizeUrl, createPkcePair } from "./pkce";
import type {
  AuthClient,
  AuthClientConfig,
  AuthResponse,
  BuildAuthorizeUrlParams,
  ExchangeAuthorizationCodeParams,
  LoginPayload,
  RegisterPayload,
  TokenResponse,
} from "../types";

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

async function requestJson<T>(
  fetchImpl: typeof fetch,
  url: string,
  init?: RequestInit,
  defaultHeaders?: Record<string, string>
): Promise<T> {
  const response = await fetchImpl(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(defaultHeaders ?? {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new AuthSdkError(readFastApiError({ response: { data: payload, status: response.status } }, "请求失败"), {
      status: response.status,
      payload,
    });
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function createAuthClient(config: AuthClientConfig): AuthClient {
  const fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const defaultHeaders = config.defaultHeaders;

  return {
    async login(payload: LoginPayload): Promise<AuthResponse> {
      return requestJson<AuthResponse>(
        fetchImpl,
        joinUrl(config.baseUrl, "/api/v1/auth/login"),
        {
          method: "POST",
          body: JSON.stringify({
            email: payload.email.trim().toLowerCase(),
            password: payload.password,
          }),
        },
        defaultHeaders
      );
    },

    async register(payload: RegisterPayload): Promise<AuthResponse> {
      return requestJson<AuthResponse>(
        fetchImpl,
        joinUrl(config.baseUrl, "/api/v1/auth/register"),
        {
          method: "POST",
          body: JSON.stringify({
            email: payload.email.trim().toLowerCase(),
            password: payload.password,
            nickname: payload.nickname?.trim() || undefined,
          }),
        },
        defaultHeaders
      );
    },

    async refresh(refreshToken: string): Promise<TokenResponse> {
      return requestJson<TokenResponse>(
        fetchImpl,
        joinUrl(config.baseUrl, "/api/v1/auth/refresh"),
        {
          method: "POST",
          body: JSON.stringify({ refresh_token: refreshToken }),
        },
        defaultHeaders
      );
    },

    async logout(refreshToken: string): Promise<void> {
      await requestJson<void>(
        fetchImpl,
        joinUrl(config.baseUrl, "/api/v1/auth/logout"),
        {
          method: "POST",
          body: JSON.stringify({ refresh_token: refreshToken }),
        },
        defaultHeaders
      );
    },

    async exchangeAuthorizationCode(params: ExchangeAuthorizationCodeParams): Promise<TokenResponse> {
      return requestJson<TokenResponse>(
        fetchImpl,
        params.tokenEndpoint,
        {
          method: "POST",
          body: JSON.stringify({
            grant_type: "authorization_code",
            code: params.code,
            client_id: params.clientId,
            redirect_uri: params.redirectUri,
            code_verifier: params.codeVerifier,
          }),
        },
        defaultHeaders
      );
    },

    buildAuthorizeUrl(params: BuildAuthorizeUrlParams): string {
      return buildAuthorizeUrl(params);
    },

    createPkcePair,
  };
}
