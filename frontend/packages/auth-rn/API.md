# `@mini-auth/auth-rn` API

`@mini-auth/auth-rn` is the React Native auth SDK for `mini-auth`. The root export is the client. Native login UI is a separate entry: `@liuyidi/auth-rn/screens` (alias `@mini-auth/auth-rn/screens` in the workspace).

## Package surface

### Runtime exports (`@mini-auth/auth-rn`)

- `createAuthClient(config)`
- `createPkcePair()`
- `buildAuthorizeUrl(params)`
- `AuthSdkError`

### Screen exports (`@mini-auth/auth-rn/screens`)

- `AuthLoginScreen`
- `MiniLoginScreen` (alias of `AuthLoginScreen`)

### Type exports

- `AuthClient`
- `AuthClientConfig`
- `AuthCredentials`
- `AuthResponse`
- `AuthUser`
- `BuildAuthorizeUrlParams`
- `ExchangeAuthorizationCodeParams`
- `LoginPayload`
- `PkcePair`
- `RegisterCredentials`
- `RegisterPayload`
- `TokenResponse`
- `AuthLoginScreenProps`
- `AuthLanguage`
- `EmailCodeStartResult`

## `createAuthClient`

```ts
const authClient = createAuthClient({
  baseUrl: "https://auth.example.com",
});
```

### Config

- `baseUrl`: API origin, without a trailing slash.
- `fetchImpl?`: optional fetch implementation for tests or custom runtimes.

### Methods

- `login({ email, password })`
  - Calls `POST /api/v1/auth/login`
  - Returns `{ user, tokens }`
- `register({ email, password, nickname? })`
  - Calls `POST /api/v1/auth/register`
  - Returns `{ user, tokens }`
- `refresh(refreshToken)`
  - Calls `POST /api/v1/auth/refresh`
  - Returns new tokens
- `logout(refreshToken)`
  - Calls `POST /api/v1/auth/logout`
- `exchangeAuthorizationCode({ tokenEndpoint, code, clientId, redirectUri, codeVerifier })`
  - Sends a standard authorization-code token request
- `buildAuthorizeUrl(params)`
  - Builds an OIDC authorization URL with PKCE parameters
- `createPkcePair()`
  - Generates a `codeVerifier` and `codeChallenge` pair using `S256`

## `AuthLoginScreen`

Native login chrome aligned with hosted `WebLoginPage`: email OTP, Google, GitHub, optional Demo.

Apps pass:

- `mode`: `"login" | "register"`
- `brand?`
- `language?` / `onLanguageChange?`
- `onSendCode(email)`
- `onVerifyCode(email, code, options?)`
- `onGooglePress?` / `onGitHubPress?` / `onDemoPress?`
- `onSwitchMode`

Session storage, navigation, and OAuth `AuthSession` stay in the app.

## Errors

`createAuthClient()` throws `AuthSdkError` for HTTP failures and transport-level auth errors.

The error object may include:

- `status`
- `payload`

## Recommended integration

1. Create one shared auth client for the app.
2. Mount `AuthLoginScreen` from `./screens` (Minibot still has a local copy; switch later).
3. Persist tokens and user session in app-owned storage.
4. Keep business navigation, profile sync, and app state outside the SDK.
