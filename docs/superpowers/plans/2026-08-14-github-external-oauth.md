# GitHub External OAuth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add production-ready GitHub login as the first implementation of a reusable external OAuth provider architecture.

**Architecture:** Explicit GitHub routes delegate to a provider-neutral OAuth flow service and a GitHub adapter. Persistent provider identities live in `user_identities`; short-lived signed state and PKCE verifier live in an HttpOnly cookie; successful login reuses the existing mini-auth session/token service.

**Tech Stack:** FastAPI, SQLAlchemy 2 async, Alembic, HTTPX, python-jose, PostgreSQL, React 19, TypeScript, Vitest.

## Global Constraints

- Identify external accounts only by `(provider, provider_subject)`, never by mutable username or email.
- GitHub account creation requires a primary verified email.
- Never silently merge an unbound GitHub identity into an existing same-email account; return `account_link_required`.
- Request only `read:user user:email`; do not persist or expose the GitHub access token.
- Validate OAuth state, PKCE context, expiry, provider, and return URL.
- Keep provider secrets and OAuth temporary credentials server-side.
- Keep Google disabled and do not implement WeChat in this plan.
- Preserve existing OIDC authorization and mini-auth access/refresh token behavior.

---

### Task 1: Persistent external identity model

**Files:**
- Create: `alembic/versions/004_user_identities.py`
- Modify: `app/models/user.py`
- Test: `tests/test_external_identity_model.py`

**Interfaces:**
- Produces: `UserIdentity` SQLAlchemy model with `provider`, `provider_subject`, optional `provider_union_id`, identity profile fields, and `user` relationship.
- Produces: `User.identities` relationship used by the account service.

- [ ] **Step 1: Write the failing model test**

Assert table name, non-null identity key columns, user relationship, and both named uniqueness constraints via SQLAlchemy table metadata.

- [ ] **Step 2: Verify RED**

Run: `python -m unittest tests.test_external_identity_model -v`

Expected: import failure because `UserIdentity` does not exist.

- [ ] **Step 3: Implement the minimal model and migration**

Add `UserIdentity` to `app/models/user.py`, including:

```python
UniqueConstraint("provider", "provider_subject", name="uq_user_identities_provider_subject")
UniqueConstraint("provider", "provider_union_id", name="uq_user_identities_provider_union_id")
```

Create Alembic revision `004`, revising `003`, with matching columns, foreign key, constraints, and `user_id` index. Downgrade drops the table.

- [ ] **Step 4: Verify GREEN and migration syntax**

Run:

```bash
python -m unittest tests.test_external_identity_model -v
python -m compileall app alembic/versions
```

Expected: model tests pass and compilation exits 0.

### Task 2: Provider-neutral state, return URL, and account resolution

**Files:**
- Create: `app/services/external_auth_types.py`
- Create: `app/services/external_auth_state.py`
- Create: `app/services/external_identity_service.py`
- Modify: `app/config.py`
- Test: `tests/test_external_auth_state.py`
- Test: `tests/test_external_identity_service.py`

**Interfaces:**
- Produces: frozen `ProviderIdentity`, `OAuthStartContext`, and `OAuthCallbackContext` dataclasses plus `ExternalAuthProvider` protocol.
- Produces: `ExternalAuthError(code: str, status_code: int)`.
- Produces: `normalize_return_url(value: str | None) -> str`.
- Produces: `create_oauth_context(provider: str, next_url: str) -> tuple[str, str, str]` returning signed context, state, and S256 challenge.
- Produces: `decode_oauth_context(token: str, provider: str, state: str) -> OAuthState`.
- Produces: `resolve_external_identity(db, identity) -> User`.

- [ ] **Step 1: Write failing state tests**

Cover relative paths, allowed HTTPS origins, rejected HTTP/unlisted origins, state round-trip, provider mismatch, state mismatch, expiry, and PKCE challenge derivation.

- [ ] **Step 2: Verify state RED**

Run: `python -m unittest tests.test_external_auth_state -v`

Expected: import failure for the new state module.

- [ ] **Step 3: Implement minimal state and config support**

Add settings:

```python
external_auth_allowed_return_origins: str = "https://auth.liuyidi.me"
external_auth_context_expire_seconds: int = 600
external_auth_cookie_secure: bool = True
```

Sign context with `JWT_SECRET`, audience `mini-auth-external-oauth`, and purpose `external_oauth_context`. Parse allowed origins as exact scheme/host/port tuples. Reject protocol-relative URLs, fragments, userinfo, non-HTTPS absolute URLs, and origins outside the allowlist.

- [ ] **Step 4: Verify state GREEN**

Run: `python -m unittest tests.test_external_auth_state -v`

Expected: all state tests pass.

- [ ] **Step 5: Write failing account resolution tests**

Cover existing identity reuse, new verified-email account creation, missing verified email, same-email conflict, mutable snapshot update, and concurrent uniqueness recovery. Mock only database boundaries and existing token-independent helpers.

- [ ] **Step 6: Verify account RED**

Run: `python -m unittest tests.test_external_identity_service -v`

Expected: import failure for `resolve_external_identity`.

- [ ] **Step 7: Implement minimal account resolution**

Query `UserIdentity` by provider/subject, ensure linked user is active, normalize email, create a random-password user only when the verified email is unused, create the identity row, and convert `IntegrityError` races into a safe re-query or `external_identity_conflict`.

- [ ] **Step 8: Verify account GREEN**

Run: `python -m unittest tests.test_external_identity_service -v`

Expected: all account tests pass.

### Task 3: GitHub adapter

**Files:**
- Create: `app/services/github_auth_provider.py`
- Modify: `app/config.py`
- Modify: `requirements.txt`
- Test: `tests/test_github_auth_provider.py`

**Interfaces:**
- Consumes: provider-neutral types from Task 2.
- Produces: `GitHubAuthProvider.build_authorization_url(context) -> str`.
- Produces: `GitHubAuthProvider.exchange_identity(callback) -> ProviderIdentity`.

- [ ] **Step 1: Read the TDD writing-good-tests reference**

Read `superpowers/test-driven-development/writing-good-tests.md` before authoring tests.

- [ ] **Step 2: Write failing adapter tests**

Use HTTPX `MockTransport` to assert real outbound request contents and simulate token/profile/email responses. Cover exact minimal scopes, PKCE fields, numeric GitHub ID, display-name fallback, primary verified email selection, missing email, OAuth denial, token exchange failure, malformed identity response, and timeout mapping.

- [ ] **Step 3: Verify adapter RED**

Run: `python -m unittest tests.test_github_auth_provider -v`

Expected: import failure for `GitHubAuthProvider`.

- [ ] **Step 4: Implement the adapter**

Add `httpx>=0.27.0` and settings:

```python
github_enabled: bool = False
github_client_id: str = ""
github_client_secret: str = ""
github_redirect_uri: str = "https://auth.liuyidi.me/api/v1/auth/github/callback"
github_http_timeout_seconds: float = 10.0
```

Use injected `httpx.AsyncClient` in tests and a bounded default client in production. Never include provider response bodies in raised public errors.

- [ ] **Step 5: Verify adapter GREEN**

Run: `python -m unittest tests.test_github_auth_provider -v`

Expected: all adapter tests pass.

### Task 4: Shared flow and explicit GitHub routes

**Files:**
- Create: `app/services/external_auth_flow_service.py`
- Create: `app/routers/github_auth.py`
- Modify: `app/main.py`
- Modify: `app/services/auth_service.py`
- Test: `tests/test_external_auth_flow_service.py`
- Test: `tests/test_github_auth_router.py`

**Interfaces:**
- Consumes: state, provider adapter, account resolution, and existing `issue_tokens`.
- Produces: `start_external_auth(provider, next_url) -> ExternalAuthStart`.
- Produces: `complete_external_auth(db, provider, code, state, signed_context) -> ExternalAuthResult`.
- Produces: `/api/v1/auth/github/start` and `/api/v1/auth/github/callback`.

- [ ] **Step 1: Write failing flow tests**

Test orchestration with a fake protocol-conforming provider: disabled/not-configured provider, start context, callback identity resolution, token issuance, and stable error propagation.

- [ ] **Step 2: Verify flow RED**

Run: `python -m unittest tests.test_external_auth_flow_service -v`

Expected: import failure for the flow service.

- [ ] **Step 3: Implement minimal shared flow**

Keep provider registration explicit. The service accepts the provider instance as a dependency so future Google/WeChat adapters reuse orchestration without a global mutable registry.

- [ ] **Step 4: Verify flow GREEN**

Run: `python -m unittest tests.test_external_auth_flow_service -v`

Expected: all flow tests pass.

- [ ] **Step 5: Write failing route tests**

Use FastAPI `TestClient` with dependency/flow patch points. Assert start redirect, temporary Cookie attributes, callback session Cookie attributes, context Cookie deletion, safe next redirect, stable login-page error redirect, missing cookie/state, and disabled configuration.

- [ ] **Step 6: Verify route RED**

Run: `python -m unittest tests.test_github_auth_router -v`

Expected: routes return 404 or import fails.

- [ ] **Step 7: Implement routes and server-side session cookies**

Add a focused helper in `auth_service.py` or the router to apply access/refresh cookies with `HttpOnly`, `SameSite=Lax`, `/`, and configured `Secure`. Register the explicit router in `app/main.py`. Always delete the OAuth context Cookie after callback processing.

- [ ] **Step 8: Verify route GREEN**

Run: `python -m unittest tests.test_github_auth_router -v`

Expected: all route tests pass.

### Task 5: Frontend provider button and safe start URL

**Files:**
- Modify: `frontend/apps/web/src/login/WebLoginPage.tsx`
- Modify: `frontend/apps/web/src/login/WebLoginPage.test.tsx`
- Modify: `frontend/apps/web/src/App.tsx`
- Modify: `frontend/apps/web/src/App.test.tsx`

**Interfaces:**
- Produces: enabled provider rendered as an anchor; unavailable provider remains disabled.
- Produces: `createExternalLoginUrl(baseUrl, provider, nextUrl) -> string` using the backend GitHub start endpoint.

- [ ] **Step 1: Write failing component tests**

Assert a configured GitHub URL renders an accessible link with exact href and without the unavailable overlay; Google and missing GitHub URLs remain disabled.

- [ ] **Step 2: Verify component RED**

Run: `pnpm --dir frontend --filter @mini-auth/web test -- src/login/WebLoginPage.test.tsx`

Expected: configured GitHub still renders disabled.

- [ ] **Step 3: Implement minimal provider rendering**

Render `<a className="mini-login-provider">` when `href` is non-empty; otherwise retain the current disabled `<button>` and overlay.

- [ ] **Step 4: Verify component GREEN**

Run the same focused Vitest command and expect all component tests to pass.

- [ ] **Step 5: Write failing App URL tests**

Assert the generated GitHub start URL uses the selected auth base URL and percent-encodes the complete current `next` value exactly once.

- [ ] **Step 6: Verify App RED**

Run: `pnpm --dir frontend --filter @mini-auth/web test -- src/App.test.tsx`

Expected: the app still depends on `VITE_GITHUB_LOGIN_URL` and does not generate the backend URL.

- [ ] **Step 7: Implement App URL generation**

Generate `/api/v1/auth/github/start?next=...` from `VITE_AUTH_BASE_URL`/runtime auth origin. Do not require a separate public GitHub URL environment variable.

- [ ] **Step 8: Verify App GREEN**

Run the focused App test and expect all tests to pass.

### Task 6: Deployment documentation and full verification

**Files:**
- Modify: `.env.example`
- Modify: `deploy/README.md`
- Modify: `docs/auth-platform-design.md`
- Modify: `README.md`

**Interfaces:**
- Documents exact GitHub OAuth callback and required production environment variables.
- Aligns the platform design with `user_identities` and the implemented provider adapter boundary.

- [ ] **Step 1: Update configuration documentation**

Document `GITHUB_ENABLED`, credentials, redirect URI, allowed return origins, secure-cookie behavior, callback URL `https://auth.liuyidi.me/api/v1/auth/github/callback`, minimal GitHub scopes, and the fact that GitHub must remain disabled until credentials are installed.

- [ ] **Step 2: Run backend verification**

Run:

```bash
python -m unittest discover -s tests -v
python -m compileall app alembic/versions tests
```

Expected: zero failures/errors and both commands exit 0.

- [ ] **Step 3: Run frontend verification**

Run:

```bash
pnpm --dir frontend --filter @mini-auth/web test
pnpm --dir frontend --filter @mini-auth/web build
```

Expected: all Vitest tests pass and Vite production build exits 0.

- [ ] **Step 4: Verify migration round-trip where PostgreSQL is available**

Run `alembic upgrade head`, inspect current revision `004`, then run `alembic downgrade 003` and `alembic upgrade 004`. If the configured PostgreSQL is unavailable, report this verification as not run rather than claiming success.

- [ ] **Step 5: Review diff and secret hygiene**

Run:

```bash
git diff --check
git status --short
rg -n "gho_|github_client_secret=.*[^=[:space:]]" . --glob '!docs/superpowers/**'
```

Expected: no whitespace errors, only intended files changed, and no committed credential value.
