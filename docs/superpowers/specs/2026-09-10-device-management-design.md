# Device Management Design

Date: 2026-09-10  
Repos: minibot-react-native, mini-auth  
Status: approved for planning

## Goal

Ship a Mail Master–style **设备管理** experience in minibot-react-native, backed by mini-auth security APIs, and align mini-auth Web `/accounts/security/` to the same information architecture.

## Scope

### In

- Device list, device detail, usage history (使用记录)
- Enrich `GET /api/v1/security/operations` for screenshot-parity fields
- Enrich audit write path with device metadata when available
- RN: three screens under settings
- Web: finer device list, device detail, usage history layout
- Revoke non-current device via existing `DELETE /api/v1/security/sessions/{id}`

### Out

- Trusted device (信任设备) model/API/CTA — deferred
- Help (`?`) page on device list header
- New `GET /sessions/{id}` detail endpoint
- Changing revoke semantics (still cannot revoke current session)
- Full E2E across RN ↔ mini-auth in this iteration

## Decisions

| Topic | Choice |
|-------|--------|
| Product scope | API enrich + RN polish + Web align; trust device later |
| RN entry | 「我」→ 账号分组 →「设备管理」 |
| Detail primary CTA | Non-current: red「退出该设备」; current: no primary button |
| Device artwork | Map name/system to product images; fallback to `kind` icons |
| Usage history | Dedicated screen matching screenshot; consume enriched operations |
| Operations data | Enrich mini-auth API (not frontend-only stubs) |
| Architecture | Approach 1: enrich operations + client-side detail from snapshot |
| Web | Align device list/detail/history UI; leave other security-center sections as-is |

## Architecture

```text
mini-auth
  GET  /api/v1/security/snapshot          → devices[] (+ existing fields)
  GET  /api/v1/security/operations        → enriched operation rows
  DELETE /api/v1/security/sessions/{id}   → revoke (409 if current)

minibot-react-native
  Me → /settings/devices
       → /settings/devices/[id]
       → /settings/devices/history
  lib/auth/security.ts (Bearer via getAccessToken)

mini-auth web
  /accounts/security/                     → refined device list
  /accounts/security/devices/:id          → detail (or equivalent full-screen panel)
  usage history page/panel                → enriched operations UI
```

Detail screens **do not** call a new API. They locate the device by `id` in the snapshot (cached or re-fetched).

## API contract (mini-auth)

### Unchanged

- `SecurityDeviceOut` already exposes: `id`, `name`, `system`, `logged_in_at`, `last_seen_at`, `kind`, `is_current`, `client_id`, `app_name`, `ip_address`, `location`.
- Revoke: `DELETE /api/v1/security/sessions/{session_id}` — batch-revokes same display name; rejects current with `409 current_device`.

### `SecurityOperationOut` (backward compatible)

Keep existing fields; add optional/enriched fields:

| Field | Required | Notes |
|-------|----------|-------|
| `id` | yes | audit log id |
| `action` | yes | human label (登录/切换账号, 退出登录, …) |
| `device` | yes | display name |
| `occurred_at` | yes | timestamp string |
| `location` | yes | geo text when known; may fall back to IP or `-` |
| `kind` | new | `mobile` \| `desktop` \| `browser` |
| `app_name` | new | e.g. Minibot; nullable for old rows |
| `ip_address` | new | raw IP when known |
| `ip_masked` | new | e.g. `115.196.84.***` |
| `status` | new | display status: login-like → `设备活跃`; logout-like → `已退出` |

Clients must treat new fields as optional and hide missing secondary lines.

### Audit write enrichment

On new login/logout (and session revoke) audit rows, persist enough metadata to populate the above (e.g. `device_label`, `client_id`, `location`) without breaking existing `AuditLog` consumers. Prefer additive columns or structured metadata over breaking `action` / `ip` / `user_agent`.

Historical rows: derive `kind`/`device` from UA; mask IP; `app_name`/`location` may be empty.

### IP masking

Server-side helper: keep first three IPv4 octets, mask last (`a.b.c.***`). IPv6: stable truncated/masked form. Empty IP → no masked field / hide in UI.

## RN screens (minibot-react-native)

### Entry

- File: `src/app/(tabs)/me.tsx` — account section `SettingsNavRow` → `/settings/devices`
- Register in `src/app/settings/_layout.tsx`
- i18n in `src/lib/i18n/messages.ts` (zh + en)

### List — `settings/devices`

- Section header: `客户端在线设备 (N)` + `使用记录 >`
- Row: artwork | name +「当前设备」badge | location subtitle | chevron
- Pull-to-refresh → snapshot
- Tap row → detail; header help icon **out of scope**

### Detail — `settings/devices/[id]`

- Hero artwork + name + current badge
- Info card: 最近使用 (`last_seen_at`), 登录方式 (`app_name` + system; hide if empty), IP (`ip_masked` + location)
- Read-only trust-capability copy optional; **no** trust button
- Footer: non-current → destructive「退出该设备」+ confirm Alert; current → no primary CTA
- Missing id after fetch → go back to list + toast

### History — `settings/devices/history`

- Title: 最近使用记录
- Group by day (`今天` / `YYYY-MM-DD`)
- Row: icon | device / app / location(ip_masked) | time + status
- Source: enriched operations

### Client module

`src/lib/auth/security.ts`:

- `getSecuritySnapshot()`
- `getSecurityOperations()`
- `revokeSession(id)`
- Auth: `Authorization: Bearer <access_token>` from `useAuth().getAccessToken()`
- Base URL: existing auth API config (`auth.liuyidi.me` / `extra.authApiBaseUrl`)

### Artwork mapping

Shared helper (RN; Web can mirror):

1. Match `name` / `system` heuristics (e.g. iPhone, MacBook, iPad, Android)
2. Else map `kind` → phone / laptop / browser icon
3. Bundled static assets preferred over remote URLs

### UI conventions

Follow existing settings patterns: `SettingsGroup`, `SettingsNavRow`, `useAppTheme()`, `SettingsStackHeader`, Lucide/`AppIcon`, no hardcoded brand colors outside theme tokens.

## Web (mini-auth frontend)

Path: `frontend/apps/web/src/security-center/`

- Refine device list rows: artwork, name, 本机 badge, location, last seen; row opens detail
- Device detail route or full-screen panel: same fields/CTA as RN
- Replace operations dialog with dedicated page/panel matching history screenshot
- Map new operations fields in `apiDataSource.ts` / `types.ts`
- Leave applications / other security sections unchanged
- Mobile web layout prioritized for screenshot parity; desktop keeps same info density

## Error handling

| Case | Behavior |
|------|----------|
| Unauthenticated / expired token | Redirect to login / refresh flow |
| Snapshot or operations fetch fail | Empty state + retry |
| Revoke current (409) | Toast: cannot revoke current device |
| Revoke success | Refresh snapshot; if on detail, navigate back to list |
| Device id not in snapshot | Back to list + “device offline / removed” message |

## Testing

- **mini-auth**: operations schema/serialization; IP mask helper; audit metadata round-trip for new logins
- **RN**: security client unit tests (mocked fetch); screen smoke — populated, empty, current device has no revoke CTA
- **Web**: operations field mapping; device detail navigation smoke
- No full cross-app E2E required this iteration

## File touch list (expected)

### mini-auth

- `app/schemas/security.py`
- `app/services/security_service.py`
- `app/models/user.py` and/or audit write path (if additive metadata)
- `app/routers/security.py` (only if signatures change)
- `frontend/apps/web/src/security-center/*`
- tests under existing security/audit suites

### minibot-react-native

- `src/lib/auth/security.ts` (new)
- `src/app/settings/devices.tsx`
- `src/app/settings/devices/[id].tsx`
- `src/app/settings/devices/history.tsx`
- `src/app/settings/_layout.tsx`
- `src/app/(tabs)/me.tsx`
- `src/lib/i18n/messages.ts`
- device artwork assets + mapper helper
- unit tests for security client

## Success criteria

1. RN user can open 设备管理 from 我, see online devices with current badge and location when available.
2. Detail shows last seen, login method, masked IP+location; non-current can revoke; current cannot.
3. 使用记录 matches screenshot structure (day groups, device/app/location/IP, time, status) using real API data for new events.
4. Web security center device + history UX matches the same IA.
5. Existing security API consumers keep working (additive operations fields).

## Follow-ups (explicitly deferred)

- Trusted device capability
- Header help content
- Dedicated session detail API if snapshot proves insufficient
- Shared cross-platform UI package
