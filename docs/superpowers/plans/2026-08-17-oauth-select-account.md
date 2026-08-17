# OAuth Select Account Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax.

**Goal:** Custom-scheme OAuth authorize shows a select-account page when IdP session exists; HTTPS stays silent SSO.

**Architecture:** Backend branches in `GET /oauth/authorize`; SPA route `/oauth/select-account` continues with `account_confirmed=1` or switches via `/logout`.

**Tech Stack:** FastAPI, React/Vite web SPA, unittest + vitest

## Global Constraints

- Only custom scheme (non-http/https) triggers interstitial
- HTTPS Web silent SSO unchanged
- No minibot code changes required
- Confirm via `account_confirmed=1`

---

### Task 1: Backend authorize branch + tests

**Files:** `app/services/oidc_service.py`, `app/routers/oidc.py`, `tests/test_oauth_select_account.py`

- [x] Helper `is_custom_scheme_redirect_uri`
- [x] Authorize redirects to `/oauth/select-account` when session + custom scheme + no confirm
- [x] Tests for HTTPS / scheme / confirmed / no session

### Task 2: SPA select-account page

**Files:** `frontend/apps/web/src/App.tsx`, `select-account/*`, tests

- [x] Route + page UI + continue/switch URLs
- [x] Vitest coverage
