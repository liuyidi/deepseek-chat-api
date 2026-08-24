# @mini-auth/auth-rn

React Native **auth SDK** for `mini-auth`, plus a native login screen aligned with the hosted web login.

## What it includes

- Auth client helpers for login, register, refresh, logout
- PKCE helpers
- Authorization URL builder
- Authorization code exchange helper
- Shared auth types
- Native `AuthLoginScreen` (email OTP + Google / GitHub / Demo). Import from `@liuyidi/auth-rn/screens`.

The root export stays fetch-only so Node and tests can use the client without React Native.

## Client

```ts
import { createAuthClient } from "@mini-auth/auth-rn";

const authClient = createAuthClient({
  baseUrl: "https://auth.example.com",
});

await authClient.login({ email, password });
```

## Native login screen

Apps own session, navigation, and OAuth. Pass callbacks into the screen:

```tsx
import { AuthLoginScreen } from "@mini-auth/auth-rn/screens";

<AuthLoginScreen
  mode="login"
  brand="Minibot"
  onSendCode={startEmailCode}
  onVerifyCode={verifyEmailCode}
  onGooglePress={loginWithGoogle}
  onGitHubPress={loginWithGitHub}
  onDemoPress={enterGuestMode}
  onSwitchMode={() => setMode(mode === "login" ? "register" : "login")}
/>;
```

`MiniLoginScreen` is an alias of `AuthLoginScreen`.

## Client API

- `createAuthClient({ baseUrl, fetchImpl? })`
- `client.login({ email, password })`
- `client.register({ email, password, nickname? })`
- `client.refresh(refreshToken)`
- `client.logout(refreshToken)`
- `client.exchangeAuthorizationCode({ tokenEndpoint, code, clientId, redirectUri, codeVerifier })`
- `client.buildAuthorizeUrl({ authorizationEndpoint, clientId, redirectUri, scope?, state?, nonce?, codeChallenge?, codeChallengeMethod? })`
- `client.createPkcePair()`

## Publishing note

The package is source-first in the workspace during development, and compiled to `dist/` when published.
