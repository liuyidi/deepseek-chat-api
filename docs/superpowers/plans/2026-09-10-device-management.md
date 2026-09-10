# Device Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Mail Master–style device list / detail / usage history in minibot-react-native, enrich mini-auth `operations` (+ audit metadata), and align Web `/accounts/security/` to the same IA.

**Architecture:** Enrich mini-auth operations from AuditLog (+ optional new columns). RN and Web detail screens read devices from snapshot by id (no new detail API). Revoke uses existing DELETE sessions endpoint.

**Tech Stack:** FastAPI + SQLAlchemy + Alembic (mini-auth); Expo Router + React Native (minibot-react-native); React SPA security-center (mini-auth web).

**Spec:** `docs/superpowers/specs/2026-09-10-device-management-design.md` (same file in both repos).

## Global Constraints

- No trusted-device API or CTA this iteration.
- Additive API fields only; keep `SecurityOperationOut.action/device/occurred_at/location`.
- RN auth: `Authorization: Bearer` via `getAccessToken()`; never cookie/`credentials: "include"`.
- RN UI: `useAppTheme()`, settings header patterns, zh+en i18n in `messages.ts`.
- Do not change revoke semantics (current device → 409 `current_device`).
- Commits: conventional prefixes; commit per task in the owning repo.

## File map

### mini-auth

| File | Responsibility |
|------|----------------|
| `app/services/ip_mask.py` (new) | `mask_ip(ip) -> str \| None` |
| `app/schemas/security.py` | Extend `SecurityOperationOut` |
| `app/models/user.py` | Add AuditLog optional `device_label`, `client_id`, `location` |
| `alembic/versions/008_audit_log_device_meta.py` (new) | Migration for those columns |
| `app/services/audit_service.py` | Accept and persist new fields |
| `app/services/auth_service.py` + callers | Pass session meta into `record_audit` where available |
| `app/services/security_service.py` | Build enriched operations; status labels |
| `tests/test_security_service.py` | Cover mask + enriched operations |
| `frontend/.../security-center/types.ts` | Extend `SecurityOperation` |
| `frontend/.../security-center/apiDataSource.ts` | Map new fields |
| `frontend/.../security-center/mockDataSource.ts` | Richer mock ops |
| `frontend/.../security-center/SecurityCenterPage.tsx` + CSS | List/detail/history UI |
| `frontend/.../App.tsx` | Routes for device detail / history if not dialog-only |

### minibot-react-native

| File | Responsibility |
|------|----------------|
| `src/lib/auth/security.ts` (new) | Snapshot / operations / revoke client |
| `src/lib/auth/__tests__/security.test.ts` (new) | Client unit tests |
| `src/lib/auth/deviceArtwork.ts` (new) | Name/system/kind → image source |
| `assets/devices/*` (new) | Fallback product images (phone/laptop/browser) |
| `src/app/settings/devices.tsx` (new) | Device list |
| `src/app/settings/devices/[id].tsx` (new) | Device detail |
| `src/app/settings/devices/history.tsx` (new) | Usage records |
| `src/app/settings/_layout.tsx` | Register screens |
| `src/app/(tabs)/me.tsx` | Entry row |
| `src/lib/i18n/messages.ts` | Copy |

---

### Task 1: IP mask helper + enriched operations (mini-auth)

**Files:**
- Create: `app/services/ip_mask.py`
- Modify: `app/schemas/security.py`
- Modify: `app/services/security_service.py` (`list_security_operations`)
- Test: `tests/test_security_service.py`

**Interfaces:**
- Produces: `mask_ip(ip: str | None) -> str | None`
- Produces: `SecurityOperationOut` fields `kind`, `app_name`, `ip_address`, `ip_masked`, `status` (all optional except keep required legacy fields)
- Consumes: existing `AuditLog` + `parse_user_agent`

- [ ] **Step 1: Write failing tests for mask_ip and enriched operations**

Add to `tests/test_security_service.py`:

```python
from app.services.ip_mask import mask_ip
from app.services.security_service import list_security_operations
from app.models.user import AuditLog

def test_mask_ip_ipv4(self) -> None:
    self.assertEqual(mask_ip("115.196.84.12"), "115.196.84.***")
    self.assertIsNone(mask_ip(None))
    self.assertIsNone(mask_ip(""))

async def test_list_security_operations_includes_enriched_fields(self) -> None:
    user = self._user()
    row = AuditLog(
        id=uuid.uuid4(),
        actor_user_id=user.id,
        action="login.email_code",
        ip="115.196.84.12",
        user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
        created_at=datetime.now(UTC),
    )
    db = AsyncMock()
    db.execute = AsyncMock(
        return_value=SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [row]))
    )
    ops = await list_security_operations(db, user)
    self.assertEqual(len(ops), 1)
    self.assertEqual(ops[0].kind, "mobile")
    self.assertEqual(ops[0].ip_masked, "115.196.84.***")
    self.assertEqual(ops[0].status, "设备活跃")
    self.assertEqual(ops[0].ip_address, "115.196.84.12")
```

- [ ] **Step 2: Run tests — expect fail**

```bash
cd /Users/liuyidi/github/mini-auth && uv run pytest tests/test_security_service.py -q -k "mask_ip or enriched"
```

Expected: FAIL (module/fields missing).

- [ ] **Step 3: Implement `ip_mask.py`**

```python
def mask_ip(ip: str | None) -> str | None:
    if not ip:
        return None
    value = ip.strip()
    if not value:
        return None
    if ":" in value:  # IPv6 — keep first 4 hextets-ish simply
        parts = value.split(":")
        kept = [p for p in parts if p][:3]
        return ":".join(kept) + ":***" if kept else "***"
    parts = value.split(".")
    if len(parts) == 4 and all(p.isdigit() for p in parts):
        return f"{parts[0]}.{parts[1]}.{parts[2]}.***"
    return value
```

- [ ] **Step 4: Extend schema**

In `SecurityOperationOut` add:

```python
kind: SecurityDeviceKind | None = None
app_name: str | None = None
ip_address: str | None = None
ip_masked: str | None = None
status: str | None = None
```

- [ ] **Step 5: Enrich `list_security_operations`**

For each audit row:
- `browser, system, kind = parse_user_agent(row.user_agent)`
- Prefer `getattr(row, "device_label", None)` for `device` when present (Task 2); else existing browser·system logic
- `app_name = _app_name_for_client(getattr(row, "client_id", None))`
- `location_text = getattr(row, "location", None) or row.ip or "-"` — keep `location` field as display location string (geo preferred; IP fallback for legacy)
- `status = "已退出" if action maps to logout/session.revoke else "设备活跃"` for login-like
- Set `ip_address=row.ip`, `ip_masked=mask_ip(row.ip)`, `kind=kind`

- [ ] **Step 6: Re-run tests — expect pass**

```bash
uv run pytest tests/test_security_service.py -q
```

- [ ] **Step 7: Commit (mini-auth)**

```bash
git add app/services/ip_mask.py app/schemas/security.py app/services/security_service.py tests/test_security_service.py
git commit -m "$(cat <<'EOF'
feat(security): enrich operations with kind, masked IP, status

EOF
)"
```

---

### Task 2: AuditLog device metadata + write sites (mini-auth)

**Files:**
- Modify: `app/models/user.py` (`AuditLog`)
- Create: `alembic/versions/008_audit_log_device_meta.py`
- Modify: `app/services/audit_service.py`
- Modify: `app/services/auth_service.py`, `app/services/security_service.py` (revoke audit), and any `record_audit` call that has session meta
- Test: extend `tests/test_security_service.py` or add focused audit test

**Interfaces:**
- Consumes: Task 1 `list_security_operations` getattr paths
- Produces: `record_audit(..., device_label=..., client_id=..., location=...)`
- Produces: Alembic revision `008` revises `007`

- [ ] **Step 1: Write failing test that operations use stored device_label/client_id/location**

Construct `AuditLog` with `device_label="iPhone 14 Plus"`, `client_id="minibot"`, `location="浙江省杭州市"` and assert operation `device`, `app_name=="Minibot"`, `location` contains 杭州.

- [ ] **Step 2: Run — expect AttributeError / fail until model updated**

- [ ] **Step 3: Add columns on `AuditLog`**

```python
device_label: Mapped[str | None] = mapped_column(String(255), nullable=True)
client_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
location: Mapped[str | None] = mapped_column(String(255), nullable=True)
```

- [ ] **Step 4: Alembic 008**

```python
revision = "008"
down_revision = "007"

def upgrade() -> None:
    op.add_column("audit_logs", sa.Column("device_label", sa.String(255), nullable=True))
    op.add_column("audit_logs", sa.Column("client_id", sa.String(100), nullable=True))
    op.add_column("audit_logs", sa.Column("location", sa.String(255), nullable=True))

def downgrade() -> None:
    op.drop_column("audit_logs", "location")
    op.drop_column("audit_logs", "client_id")
    op.drop_column("audit_logs", "device_label")
```

- [ ] **Step 5: Extend `record_audit` signature and persist fields**

- [ ] **Step 6: Thread SessionMeta / session fields into login, logout, and `revoke_security_session` audit writes**

When creating sessions, pass `device_label`, `client_id`, `location` from the same sources used for `AuthSession`.

- [ ] **Step 7: Run security tests**

```bash
uv run pytest tests/test_security_service.py tests/ -q -k "audit or security or operation" --maxfail=20
```

- [ ] **Step 8: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(security): persist device metadata on audit logs

EOF
)"
```

---

### Task 3: RN security API client

**Files:**
- Create: `src/lib/auth/security.ts`
- Create: `src/lib/auth/__tests__/security.test.ts`
- Pattern: `src/lib/auth/identities.ts`

**Interfaces:**
- Produces:
  - `export type SecurityDevice = { id, name, system, loggedInAt, lastSeenAt, kind, isCurrent, clientId?, appName?, ipAddress?, location? }`
  - `export type SecurityOperation = { id, action, device, occurredAt, location, kind?, appName?, ipAddress?, ipMasked?, status? }`
  - `export type SecuritySnapshot = { devices: SecurityDevice[] }` (only fields RN needs; may include user if handy)
  - `fetchSecuritySnapshot(accessToken: string): Promise<SecuritySnapshot>`
  - `fetchSecurityOperations(accessToken: string): Promise<SecurityOperation[]>`
  - `revokeSecuritySession(accessToken: string, sessionId: string): Promise<void>`
  - `maskIpForDisplay(ip: string | null | undefined): string | null` (client fallback if API omits ip_masked)
- Consumes: `getAuthApiBaseUrl()` from `@/lib/chat/apiConfig`

- [ ] **Step 1: Write failing client tests** (mock `global.fetch`)

```typescript
import {
  fetchSecuritySnapshot,
  fetchSecurityOperations,
  revokeSecuritySession,
} from "@/lib/auth/security";

test("maps snapshot devices from snake_case", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      devices: [
        {
          id: "1",
          name: "iPhone",
          system: "iOS",
          logged_in_at: "2026/09/10 10:00:00",
          last_seen_at: "2026/09/10 16:00:00",
          kind: "mobile",
          is_current: true,
          app_name: "Minibot",
          ip_address: "1.2.3.4",
          location: "浙江省杭州市",
        },
      ],
    }),
  });
  const snap = await fetchSecuritySnapshot("tok");
  expect(snap.devices[0].isCurrent).toBe(true);
  expect(snap.devices[0].appName).toBe("Minibot");
});

test("revoke throws on 409", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 409,
    json: async () => ({ detail: { code: "current_device" } }),
  });
  await expect(revokeSecuritySession("tok", "1")).rejects.toThrow(/current/i);
});
```

(Adapt to project’s jest/vitest — check `package.json` test runner; match `externalOAuth.test.ts` style.)

- [ ] **Step 2: Run test — fail**

```bash
cd /Users/liuyidi/github/minibot-react-native && npm test -- --testPathPattern=security.test
```

- [ ] **Step 3: Implement `security.ts`**

- GET `{base}/api/v1/security/snapshot`
- GET `{base}/api/v1/security/operations`
- DELETE `{base}/api/v1/security/sessions/{id}`
- Headers: `{ Authorization: \`Bearer ${accessToken}\` }`
- Map snake_case → camelCase
- On non-OK: throw Error with message; special-case 409 for revoke

- [ ] **Step 4: Tests pass**

- [ ] **Step 5: Commit (RN)**

```bash
git commit -m "$(cat <<'EOF'
feat(auth): add mini-auth security API client

EOF
)"
```

---

### Task 4: Device artwork mapper (RN)

**Files:**
- Create: `src/lib/auth/deviceArtwork.ts`
- Create: `src/lib/auth/__tests__/deviceArtwork.test.ts`
- Create: `assets/devices/phone.png`, `laptop.png`, `browser.png` (simple placeholder PNGs or reuse existing brand assets; document mapping)

**Interfaces:**
- Produces: `resolveDeviceArtwork(input: { name: string; system: string; kind: "mobile"|"desktop"|"browser" }): ImageSourcePropType`

- [ ] **Step 1: Failing tests for iPhone → phone, MacBook → laptop, unknown browser kind → browser**

- [ ] **Step 2: Implement heuristics**

```typescript
const lower = `${name} ${system}`.toLowerCase();
if (/iphone|ipad|android|pixel/.test(lower) || kind === "mobile") return phoneAsset;
if (/macbook|imac|windows|desktop|electron/.test(lower) || kind === "desktop") return laptopAsset;
return browserAsset;
```

Prefer name hits over kind when both present (e.g. name contains iPhone).

- [ ] **Step 3: Tests pass + commit**

```bash
git commit -m "$(cat <<'EOF'
feat(auth): map device names to artwork assets

EOF
)"
```

---

### Task 5: RN device list + Me entry + i18n

**Files:**
- Create: `src/app/settings/devices.tsx`
- Modify: `src/app/settings/_layout.tsx`
- Modify: `src/app/(tabs)/me.tsx`
- Modify: `src/lib/i18n/messages.ts`

**Interfaces:**
- Consumes: `fetchSecuritySnapshot`, `resolveDeviceArtwork`, `useAuth().getAccessToken`
- Routes: `/settings/devices`, push `/settings/devices/${id}`, `/settings/devices/history`

- [ ] **Step 1: Add i18n keys** under `me.devices`, `settingsTitles.devices`, `devices.*` (list header, usage records link, current badge, empty, retry, load error) in zh + en + type definition

- [ ] **Step 2: Register stack screens**

```tsx
<Stack.Screen name="devices" options={{ title: t("settingsTitles.devices") }} />
<Stack.Screen name="devices/[id]" options={{ title: t("settingsTitles.deviceDetail") }} />
<Stack.Screen name="devices/history" options={{ title: t("settingsTitles.deviceHistory") }} />
```

Note: Expo Router file-based routes — verify whether nested `devices/` folder needs a `devices/_layout.tsx`. Prefer:

- `src/app/settings/devices/index.tsx` (list)
- `src/app/settings/devices/[id].tsx`
- `src/app/settings/devices/history.tsx`
- optional `src/app/settings/devices/_layout.tsx` Stack

If using flat `devices.tsx` + `devices/[id].tsx`, follow Expo Router conventions already in repo (inspect `about` nesting).

- [ ] **Step 3: Implement list screen**

- `useFocusEffect` / mount load snapshot
- Section: `客户端在线设备 (N)` + pressable `使用记录 >`
- Rows: Image + name + badge if `isCurrent` + location + ChevronRight
- Pull-to-refresh
- Empty / error / retry states

- [ ] **Step 4: Me entry** — `SettingsNavRow` title `t("me.devices")` with `Smartphone` (or similar) icon, `router.push("/settings/devices")`, showDivider on account row as needed

- [ ] **Step 5: Manual smoke in Expo / typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(settings): add device management list and Me entry

EOF
)"
```

---

### Task 6: RN device detail

**Files:**
- Create: `src/app/settings/devices/[id].tsx` (or ensure from Task 5)
- i18n: detail labels + revoke copy

**Interfaces:**
- Consumes: snapshot device by `useLocalSearchParams().id`, `revokeSecuritySession`

- [ ] **Step 1: Implement detail UI**

- Hero image + name + current badge
- Card rows: 最近使用, 登录方式 (`[appName, system].filter(Boolean).join(" · ")`), IP (`ipMasked || maskIpForDisplay(ipAddress)` + location)
- No trust button
- Footer button only if `!isCurrent`: red full-width pill; Alert confirm → revoke → back

- [ ] **Step 2: Missing device after fetch → `router.back()` + Alert

- [ ] **Step 3: Typecheck + commit**

```bash
git commit -m "$(cat <<'EOF'
feat(settings): add login device detail and revoke

EOF
)"
```

---

### Task 7: RN usage history

**Files:**
- Create: `src/app/settings/devices/history.tsx`

**Interfaces:**
- Consumes: `fetchSecurityOperations`

- [ ] **Step 1: Group-by-date helper** (today label via i18n)

Parse `occurredAt` (`YYYY/MM/DD HH:MM:SS` or ISO). Group key = date part; label `今天` if local today.

- [ ] **Step 2: Implement history list UI** matching screenshot: icon, device, appName, location+(ipMasked), time, status

- [ ] **Step 3: Typecheck + commit**

```bash
git commit -m "$(cat <<'EOF'
feat(settings): add recent device usage history screen

EOF
)"
```

---

### Task 8: Web security types + data mapping

**Files:**
- Modify: `frontend/apps/web/src/security-center/types.ts`
- Modify: `frontend/apps/web/src/security-center/apiDataSource.ts`
- Modify: `frontend/apps/web/src/security-center/mockDataSource.ts`
- Test: `apiDataSource.test.ts`, `mockDataSource.test.ts`

**Interfaces:**
- Extend `SecurityOperation` with optional `kind?`, `appName?`, `ipAddress?`, `ipMasked?`, `status?`
- Map from API snake_case in `getOperations`

- [ ] **Step 1: Failing test asserting mapped `ipMasked` / `status`**

- [ ] **Step 2: Implement mapping + mock data**

- [ ] **Step 3: Tests pass + commit (mini-auth)**

```bash
git commit -m "$(cat <<'EOF'
feat(security-web): map enriched security operations fields

EOF
)"
```

---

### Task 9: Web UI — device detail + history layout

**Files:**
- Modify: `SecurityCenterPage.tsx`, `security-center.css`
- Modify: `App.tsx` if adding `/accounts/security/devices/:id` and `/accounts/security/history`
- Test: `SecurityCenterPage.test.tsx`

**Interfaces:**
- Same IA as RN; detail from snapshot device; history uses enriched operations
- Non-current revoke; current badge only
- Prefer dedicated routes for deep links; acceptable: full-screen panels if routing churn is high — pick routes if `App.tsx` already pathname-switches

- [ ] **Step 1: Refine device list row** (artwork/kind icon, location, last seen, navigate to detail)

- [ ] **Step 2: Device detail view** (hero, info rows, revoke CTA)

- [ ] **Step 3: History view** (day groups, richer row; replace thin dialog)

- [ ] **Step 4: Update page tests for navigation / revoke visibility**

- [ ] **Step 5: Run frontend tests**

```bash
cd /Users/liuyidi/github/mini-auth/frontend/apps/web && npm test -- --run
```

- [ ] **Step 6: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(security-web): align device list, detail, and usage history UI

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Enrich operations fields | 1 |
| Audit metadata for new events | 2 |
| RN security client Bearer | 3 |
| Product artwork mapping | 4 |
| Me → 设备管理 list | 5 |
| Device detail + revoke non-current | 6 |
| Usage history page | 7 |
| Web field mapping | 8 |
| Web UI align | 9 |
| No trusted device | (all) |
| No new detail API | 6, 9 |

## Self-review notes

- No TBD placeholders in task steps.
- Status strings default Chinese to match existing `_ACTION_LABELS` / product screenshots; RN i18n may map status codes later — for v1 display API `status` as returned, with optional EN passthrough table in RN if language=en.
- Expo route shape (`devices.tsx` vs `devices/index.tsx`) verified in Task 5 against repo conventions before creating files.
