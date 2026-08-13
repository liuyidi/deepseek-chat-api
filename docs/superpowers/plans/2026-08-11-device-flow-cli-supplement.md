# Device Flow CLI Supplement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add OAuth 2.0 Device Authorization Grant as a supplementary CLI login path for mini-auth, without changing the primary Web/RN OIDC + PKCE flow.

**Architecture:** Keep Device Flow as an optional grant type alongside the existing authorization-code flow. The CLI should request a device code, direct the user to a verification page, poll for completion, and exchange the approved device code for tokens. The browser-facing activation page and the CLI polling API should be isolated so the feature can ship independently and stay off by default until the CLI integration needs it.

**Tech Stack:** FastAPI, PostgreSQL, Redis or short-lived DB records for device authorization state, existing JWT/token service, existing auth web pages.

## Global Constraints

- Preserve OIDC Authorization Code + PKCE as the default flow for Web, Desktop, and RN.
- Device Flow must be an additive supplement for CLI, not a replacement for existing login paths.
- Do not enable the feature by default until the CLI integration work is explicitly started.
- Keep user-facing copy aligned with the existing mini-auth branding and login experience.

---

### Task 1: Define the Device Flow contract

**Files:**
- Modify: `docs/auth-platform-design.md`
- Create: `app/schemas/device_flow.py`

**Interfaces:**
- Consumes: existing OIDC / token terminology in the design doc
- Produces: request/response schemas for device authorization and token polling

- [ ] **Step 1: Write the contract notes**

Add the Device Flow supplement section to the design doc with:
- `POST /oauth/device/code`
- `POST /oauth/device/token`
- `GET /device`

- [ ] **Step 2: Define request/response models**

```python
from pydantic import BaseModel

class DeviceCodeRequest(BaseModel):
    client_id: str
    scope: str | None = None

class DeviceCodeResponse(BaseModel):
    device_code: str
    user_code: str
    verification_uri: str
    verification_uri_complete: str | None = None
    expires_in: int
    interval: int

class DeviceTokenRequest(BaseModel):
    grant_type: str
    device_code: str
    client_id: str
```

- [ ] **Step 3: Add the token-polling status model**

```python
class DeviceTokenError(BaseModel):
    error: str
    error_description: str | None = None
```

### Task 2: Implement device authorization storage and endpoints

**Files:**
- Create: `app/services/device_flow_service.py`
- Create: `app/routers/device_flow.py`
- Modify: `app/main.py`

**Interfaces:**
- Consumes: `DeviceCodeRequest`, `DeviceCodeResponse`, `DeviceTokenRequest`
- Produces: device code issuance, verification, approval, and token exchange behavior

- [ ] **Step 1: Add failing tests for issuance and polling**

Write tests that assert:
- a device code request returns `device_code`, `user_code`, and a verification URL
- polling before approval returns `authorization_pending`
- polling after approval returns an access token

- [ ] **Step 2: Implement short-lived device state**

```python
@dataclass
class DeviceAuthRecord:
    device_code: str
    user_code: str
    client_id: str
    scope: str
    expires_at: float
    interval_s: int
    approved_user_id: str | None = None
    denied: bool = False
```

- [ ] **Step 3: Expose the device endpoints**

Add:
- `POST /oauth/device/code`
- `POST /oauth/device/token`
- `POST /oauth/device/verify`

### Task 3: Add the activation page for user_code entry

**Files:**
- Create: `app/routers/device_web.py`
- Modify: `app/routers/web.py`

**Interfaces:**
- Consumes: `user_code`, verification page route, approval state
- Produces: a simple login/approval page for humans to authorize the device

- [ ] **Step 1: Write the failing page test**

Assert the activation page renders:
- a `user_code` input
- a confirm/approve button
- an error for invalid or expired codes

- [ ] **Step 2: Implement the page and approval handler**

The page should:
- accept a `user_code`
- look up the pending device request
- show the device/app name
- let the user approve or deny

### Task 4: Add CLI client support later

**Files:**
- Modify: `frontend/packages/auth-rn/README.md`
- Modify: `docs/auth-platform-design.md`

**Interfaces:**
- Consumes: Device Flow endpoints
- Produces: CLI login guidance and polling behavior

- [ ] **Step 1: Document the CLI supplement flow**

Explain that CLI can:
- request a device code
- print the verification URL and user code
- poll until authorized

- [ ] **Step 2: Keep the feature opt-in**

Make sure the docs say this path is a supplement, not the default for Web/RN.
