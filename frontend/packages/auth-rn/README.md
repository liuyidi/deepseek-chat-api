# @mini-auth/auth-rn

Single React Native auth package for `mini-auth`.

## What it includes

- Auth client helpers for login, register, refresh, logout
- PKCE helpers
- Authorization URL builder
- Authorization code exchange helper
- Reusable login and register screens for RN

## Intended usage

This is the only RN package business apps should consume.

```tsx
import { AuthLoginScreen, createAuthClient } from "@mini-auth/auth-rn";

const authClient = createAuthClient({
  baseUrl: "https://auth.example.com",
});

function LoginPage() {
  return (
    <AuthLoginScreen
      brand="My App"
      title="登录"
      subtitle="欢迎回来"
      description="请使用邮箱和密码登录。"
      emailLabel="邮箱"
      passwordLabel="密码"
      submitLabel="登录"
      registerHint="还没有账号？"
      registerLinkLabel="去注册"
      onLogin={(credentials) => authClient.login(credentials)}
    />
  );
}
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

## Example

See [`example/App.tsx`](./example/App.tsx) for a minimal end-to-end RN login/register integration sample.
