# @mini-auth/auth-rn

Single React Native **auth SDK** package for `mini-auth`.

## What it includes

- Auth client helpers for login, register, refresh, logout
- PKCE helpers
- Authorization URL builder
- Authorization code exchange helper
- Shared auth types (`AuthUser`, `AuthResponse`, `TokenResponse`, etc.)

## What it does NOT include

- Login/register screens were removed from this package.
- Apps should implement their own login UI (Minibot uses `MiniLoginScreen`) and call this SDK.

## Intended usage

```tsx
import { createAuthClient } from "@mini-auth/auth-rn";

const authClient = createAuthClient({
  baseUrl: "https://auth.example.com",
});

await authClient.login({ email, password });
```

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
