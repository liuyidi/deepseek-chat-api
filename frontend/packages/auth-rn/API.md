# `@mini-auth/auth-rn` API

`@mini-auth/auth-rn` is the single React Native auth package for `mini-auth`.

## Package surface

### Runtime exports

- `createAuthClient(config)`
- `createPkcePair()`
- `buildAuthorizeUrl(params)`
- `AuthLoginScreen`
- `AuthRegisterScreen`
- `AuthSdkError`

### Type exports

- `AuthClient`
- `AuthClientConfig`
- `AuthCredentials`
- `AuthLoginScreenProps`
- `AuthRegisterScreenProps`
- `AuthResponse`
- `AuthUser`
- `BuildAuthorizeUrlParams`
- `DemoAccount`
- `ExchangeAuthorizationCodeParams`
- `LoginPayload`
- `PkcePair`
- `RegisterCredentials`
- `RegisterPayload`
- `TokenResponse`

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

## Screen components

### `AuthLoginScreen`

Use this for a fully managed RN login page.

Required props:

- `brand`
- `title`
- `subtitle`
- `description`
- `emailLabel`
- `passwordLabel`
- `submitLabel`
- `registerHint`
- `registerLinkLabel`
- `onLogin`

Optional props:

- `guestLabel`
- `demoAccount`
- `onRegisterPress`
- `onGuestPress`
- `onSuccess`

### `AuthRegisterScreen`

Use this for a fully managed RN register page.

Required props:

- `brand`
- `title`
- `subtitle`
- `description`
- `emailLabel`
- `nicknameLabel`
- `passwordLabel`
- `confirmPasswordLabel`
- `submitLabel`
- `loginHint`
- `loginLinkLabel`
- `onRegister`

Optional props:

- `onLoginPress`
- `onSuccess`

## Errors

`createAuthClient()` throws `AuthSdkError` for HTTP failures and transport-level auth errors.

The error object may include:

- `status`
- `payload`

## Recommended integration

1. Create one shared auth client for the app.
2. Use `AuthLoginScreen` and `AuthRegisterScreen` for RN auth entry points.
3. Persist tokens and user session in app-owned storage.
4. Keep business navigation, profile sync, and app state outside the SDK.
