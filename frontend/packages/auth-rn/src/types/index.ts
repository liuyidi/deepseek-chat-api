export type AuthUser = {
  id: string;
  email: string;
  nickname: string;
  bio?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  created_at?: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  email: string;
  password: string;
  nickname?: string;
};

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  id_token?: string | null;
  token_type: "bearer" | string;
  expires_in: number;
};

export type AuthResponse = {
  user: AuthUser;
  tokens: TokenResponse;
};

export type PkcePair = {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
};

export type BuildAuthorizeUrlParams = {
  authorizationEndpoint: string;
  clientId: string;
  redirectUri: string;
  scope?: string[] | string;
  state?: string;
  nonce?: string;
  codeChallenge: string;
  codeChallengeMethod?: "S256" | "plain";
  responseType?: "code";
};

export type ExchangeAuthorizationCodeParams = {
  tokenEndpoint: string;
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
};

export type AuthClientConfig = {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  /** Merged into every SDK request (e.g. `X-Device-Label`). */
  defaultHeaders?: Record<string, string>;
};

export type AuthClient = {
  login: (payload: LoginPayload) => Promise<AuthResponse>;
  register: (payload: RegisterPayload) => Promise<AuthResponse>;
  refresh: (refreshToken: string) => Promise<TokenResponse>;
  logout: (refreshToken: string) => Promise<void>;
  exchangeAuthorizationCode: (params: ExchangeAuthorizationCodeParams) => Promise<TokenResponse>;
  buildAuthorizeUrl: (params: BuildAuthorizeUrlParams) => string;
  createPkcePair: () => Promise<PkcePair>;
};

export type AuthCredentials = {
  email: string;
  password: string;
};

export type RegisterCredentials = AuthCredentials & {
  nickname?: string;
};
