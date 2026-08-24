# Frontend Workspace

This directory is the frontend workspace for `mini-auth`.

## Structure

```text
frontend/
  apps/
    web/        # Responsive web login and admin-facing auth pages
  packages/
    auth-ui/    # Shared responsive login page and auth screens
    auth-rn/    # React Native auth SDK (client, PKCE, tokens; no screens)
```

## Design Goals

- Keep Web as a single responsive auth surface.
- Keep React Native in the frontend workspace as a single reusable package.
- Reuse the same auth protocol, API contracts, and redirect rules everywhere.

## Suggested Ownership

- `apps/web`: responsive server-rendered or SPA login experience.
- `packages/auth-ui`: shared login page and responsive auth screen components.
- `packages/auth-rn`: RN SDK with token, login, refresh, logout, PKCE, and redirect helpers. Apps own login UI.

## Recommended scripts

After installing dependencies inside `frontend/`, you can run:

```bash
npm run dev -w @mini-auth/web
npm run build
```

The web app reuses the shared `LoginPage` component from `packages/auth-ui` and adapts the layout responsively.
React Native consumers should depend on `packages/auth-rn` only.
