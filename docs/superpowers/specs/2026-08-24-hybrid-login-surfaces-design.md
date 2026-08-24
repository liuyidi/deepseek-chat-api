# Hybrid login surfaces (transition to Taro)

Date: 2026-08-24  
Status: in progress (screen lives in auth-rn; Minibot still uses its local copy)  
Repos: `mini-auth` (`frontend/`), `minibot-react-native`

## Problem

Login UI drifted into three places: hosted web (`WebLoginPage`), Minibot native (`MiniLoginScreen`), and a retired password-based `auth-rn` screen. The product goal is still: **mini-auth owns login + API; apps only plug in.** RN must **not** look like a webpage.

## Decision

Use a **hybrid** layout now. Unify with **Taro** later.

| Surface | Now | Later (Taro) |
|---|---|---|
| Web / H5 | Hosted page at `auth.liuyidi.me` (`apps/web` + `WebLoginPage`) | Same hosted app, render Taro **web** output |
| React Native | Native screen in `@liuyidi/auth-rn`, visually aligned with `WebLoginPage` | Same package, render Taro **RN** output |
| Apps (`minibot`, `minibot-react-native`, future) | Call API + mount the matching surface | Unchanged app contract |

Google / GitHub on RN still open the **system browser for the IdP**. That is not “login looks like a webpage.” The **login chrome** (headline, email OTP, provider buttons, demo) stays native.

## Non-goals (this phase)

- Do not introduce Taro, a second H5 app, or WebView login chrome.
- Do not put `@minibot/ui` into `auth-rn`.
- Do not bring back email/password screens as the main path.

## Shared login contract

Both web and RN screens accept the same app-facing shape (names may be aliased, fields must match):

- `mode`: `"login" | "register"`
- `brand`: string (e.g. `"Minibot"`)
- `onSendCode(email)` → `{ email, resend_after_seconds, debug_code? }`
- `onVerifyCode(email, code, options?: { username? })`
- optional `onGooglePress` / `onGitHubPress` / `onDemoPress`
- `onSwitchMode`

Copy, colors, provider order, OTP + cooldown, and “register is first login” stay aligned with `WebLoginPage`. Branding is a prop; Minibot-specific headlines/legal links stay injectable or defaulted by the app.

This contract is the freeze line for Taro: Taro components must implement **this** API, not a new one.

## Package layout (transition)

```text
frontend/
  apps/web              # hosted OIDC login (source of visual truth)
  packages/auth-ui      # web LoginPage (keep until Taro replaces it)
  packages/auth-rn
    src/core/           # client, PKCE, token, email-code helpers
    src/screens/        # native AuthLoginScreen (from MiniLoginScreen)
```

`auth-rn` exports:

1. SDK: `createAuthClient` (extend with email-code start/verify; keep password login as legacy if the API still exists)
2. UI: `AuthLoginScreen` (native, contract above)

Peer deps for the screen: `react`, `react-native`, `react-native-safe-area-context`, `react-native-svg`. Core client stays fetch-only so Node/tests can import SDK without RN.

## App wiring

`minibot-react-native`:

- **Not switched yet.** Keep local `MiniLoginScreen` until a later change.
- Next: `AuthEntryScreen` mounts `AuthLoginScreen` from `@liuyidi/auth-rn/screens`.
- Session, navigation, guest/demo, Google/GitHub `AuthSession` stay in the app (`AuthContext`).
- Then delete the local `MiniLoginScreen` so Minibot does not keep a fork.

`minibot` web/desktop: unchanged hosted redirect to `auth.liuyidi.me`.

## Alignment rules

- Visual tokens copy `WebLoginPage` / Direction 02 (light canvas, ink, Google/GitHub marks).
- Do not invent a third provider list. Phone / WeChat stay off until IdP enables them.
- Email-code request/response types live in `auth-rn` (and stay compatible with `auth-ui` `EmailCodeStartResult`).

## Phase B: Taro

When Taro lands:

1. Add `frontend/packages/auth-surfaces` (or similar) as the **single** login source.
2. Build web component → `apps/web` consumes it; RN component → `auth-rn` re-exports it.
3. Retire duplicate `WebLoginPage` / RN `AuthLoginScreen` implementations.
4. Keep the shared contract; only the renderer changes.

Do not start Taro until the RN screen has been extracted and Minibot is consuming it without a local copy.

## Success

- Minibot RN login is native and matches web methods.
- No login UI source of truth in `minibot-react-native`.
- Web/H5 still one hosted page.
- Taro can replace both UIs without changing app callbacks.
