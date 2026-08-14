# Mini Auth PC Security Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Feishu-inspired, PC-only interactive account security center at `/accounts/security/`, backed by a typed asynchronous Mock data source.

**Architecture:** Keep the existing login UI unchanged and add path selection in the Web app. The security page consumes a `SecurityCenterDataSource` contract; an in-memory Mock implementation supplies all data and mutations so a future HTTP adapter can replace it without changing the page.

**Tech Stack:** React 19, TypeScript, Vite, CSS, Vitest, Testing Library, jsdom

## Global Constraints

- Implement application code only under `frontend/apps/web/src`; do not modify `frontend/packages/auth-ui`.
- `/accounts/security/` renders the security center and `/accounts/` redirects to it; `/` preserves the current login page.
- Target PC browsers with a two-column layout; no dedicated mobile redesign.
- Use mini-auth branding and inline SVG/CSS icons; do not copy Feishu brand assets, avatar, or support robot.
- Use a typed asynchronous front-end data source; do not define backend URLs, HTTP methods, request bodies, database changes, or server response schemas in this iteration.
- Mock interactions must include two-step verification, device revocation, operation history, settings, authorized apps, help, and customer-service feedback.

---

## File Structure

- Create `frontend/apps/web/src/security-center/types.ts`: domain types, operation input types, and `SecurityCenterDataSource` contract.
- Create `frontend/apps/web/src/security-center/mockDataSource.ts`: stateful asynchronous Mock implementation.
- Create `frontend/apps/web/src/security-center/mockDataSource.test.ts`: contract behavior tests.
- Create `frontend/apps/web/src/security-center/SecurityCenterPage.tsx`: page composition, UI state, dialogs, and interactions.
- Create `frontend/apps/web/src/security-center/security-center.css`: isolated PC security-center visuals.
- Create `frontend/apps/web/src/security-center/SecurityCenterPage.test.tsx`: loading and interaction tests.
- Create `frontend/apps/web/src/App.test.tsx`: route selection and redirect tests.
- Create `frontend/apps/web/src/test/setup.ts`: DOM test cleanup and matcher setup.
- Modify `frontend/apps/web/src/App.tsx`: lightweight pathname routing and data-source injection.
- Modify `frontend/apps/web/vite.config.ts`: Vitest jsdom configuration.
- Modify `frontend/apps/web/tsconfig.json`: include Vitest globals for test compilation.
- Modify `frontend/apps/web/package.json` and `frontend/pnpm-lock.yaml`: add test script and test-only dependencies.

### Task 1: Typed Security Center Contract and Mock Data Source

**Files:**
- Create: `frontend/apps/web/src/security-center/types.ts`
- Create: `frontend/apps/web/src/security-center/mockDataSource.ts`
- Create: `frontend/apps/web/src/security-center/mockDataSource.test.ts`
- Modify: `frontend/apps/web/package.json`
- Modify: `frontend/apps/web/vite.config.ts`
- Modify: `frontend/apps/web/tsconfig.json`
- Create: `frontend/apps/web/src/test/setup.ts`
- Modify: `frontend/pnpm-lock.yaml`

**Interfaces:**
- Produces: `SecurityCenterDataSource`, `SecurityCenterSnapshot`, `SecurityOverview`, `SecurityDevice`, `SecuritySetting`, `SecurityOperation`, `AuthorizedApplication`, and `SecurityCenterError`.
- Produces: `createMockSecurityCenterDataSource(): SecurityCenterDataSource`.

- [ ] **Step 1: Install and configure the test harness**

Run:

```bash
cd frontend
pnpm --filter @mini-auth/web add -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

Add `"test": "vitest run"` to `frontend/apps/web/package.json`, add a `test` block with `environment: "jsdom"` and `setupFiles: ["./src/test/setup.ts"]` to Vite config, and import `@testing-library/jest-dom/vitest` plus Testing Library cleanup in `setup.ts`.

- [ ] **Step 2: Write failing Mock contract tests**

Create tests that require this behavior:

```ts
const source = createMockSecurityCenterDataSource();
const initial = await source.getSnapshot();
expect(initial.overview.score).toBe(70);
expect(initial.devices.filter((device) => device.isCurrent)).toHaveLength(1);

const updated = await source.setTwoFactorEnabled(true);
expect(updated.twoFactorEnabled).toBe(true);
expect(updated.score).toBeGreaterThan(initial.overview.score);

await source.revokeDevice("safari-iphone");
const afterRevoke = await source.getSnapshot();
expect(afterRevoke.devices.some((device) => device.id === "safari-iphone")).toBe(false);

await expect(source.revokeDevice("chrome-mac-current")).rejects.toMatchObject({
  code: "CURRENT_DEVICE",
});
```

- [ ] **Step 3: Run the contract tests and verify failure**

Run:

```bash
cd frontend
pnpm --filter @mini-auth/web test -- src/security-center/mockDataSource.test.ts
```

Expected: FAIL because the domain types and Mock source do not exist.

- [ ] **Step 4: Implement the front-end contract**

Define the exact data-source surface in `types.ts`:

```ts
export interface SecurityCenterDataSource {
  getSnapshot(): Promise<SecurityCenterSnapshot>;
  setTwoFactorEnabled(enabled: boolean): Promise<SecurityOverview>;
  revokeDevice(deviceId: string): Promise<void>;
  getOperations(): Promise<SecurityOperation[]>;
  getAuthorizedApplications(): Promise<AuthorizedApplication[]>;
}
```

Define discriminated string unions for setting status and icon names. Define `SecurityCenterError` with codes `CURRENT_DEVICE`, `NOT_FOUND`, and `MOCK_FAILURE`.

- [ ] **Step 5: Implement the stateful Mock source**

Create `createMockSecurityCenterDataSource()` with private in-memory state, a short deterministic async delay, cloned return values, one current Chrome/macOS device, two removable devices, six protection settings, operation history, and two authorized applications. Enabling two-step verification must change its label to `已设置`, raise the score from `70` to `82`, and reduce optimizable items from `6` to `5`.

- [ ] **Step 6: Run tests and build**

Run:

```bash
cd frontend
pnpm --filter @mini-auth/web test -- src/security-center/mockDataSource.test.ts
pnpm --filter @mini-auth/web build
```

Expected: both commands exit 0.

- [ ] **Step 7: Commit the contract layer**

```bash
git add frontend/apps/web/package.json frontend/apps/web/vite.config.ts frontend/apps/web/tsconfig.json frontend/apps/web/src/test/setup.ts frontend/apps/web/src/security-center/types.ts frontend/apps/web/src/security-center/mockDataSource.ts frontend/apps/web/src/security-center/mockDataSource.test.ts frontend/pnpm-lock.yaml
git commit -m "Add security center mock data contract"
```

### Task 2: Route Selection and Data-Source Injection

**Files:**
- Modify: `frontend/apps/web/src/App.tsx`
- Create: `frontend/apps/web/src/App.test.tsx`
- Create: `frontend/apps/web/src/security-center/SecurityCenterPage.tsx`

**Interfaces:**
- Consumes: `SecurityCenterDataSource` and `createMockSecurityCenterDataSource()` from Task 1.
- Produces: `SecurityCenterPage({ dataSource }: { dataSource: SecurityCenterDataSource })`.
- Produces: `resolveAppRoute(pathname: string): "login" | "security" | "security-redirect"`.

- [ ] **Step 1: Write failing route tests**

Add table-driven assertions:

```ts
expect(resolveAppRoute("/")).toBe("login");
expect(resolveAppRoute("/accounts/")).toBe("security-redirect");
expect(resolveAppRoute("/accounts")).toBe("security-redirect");
expect(resolveAppRoute("/accounts/security/")).toBe("security");
expect(resolveAppRoute("/accounts/security")).toBe("security");
```

Also render `App` at the security path and assert that `createMockSecurityCenterDataSource` is injected into the security page rather than rendering `LoginPage`.

- [ ] **Step 2: Run route tests and verify failure**

Run:

```bash
cd frontend
pnpm --filter @mini-auth/web test -- src/App.test.tsx
```

Expected: FAIL because route resolution and `SecurityCenterPage` are absent.

- [ ] **Step 3: Implement route selection**

Extract the pure `resolveAppRoute` function. Keep the existing login construction in a `LoginRoute` component. Create one module-level Mock source and inject it into `SecurityCenterPage`. For `security-redirect`, call:

```ts
window.location.replace("/accounts/security/");
return null;
```

Initially make `SecurityCenterPage` render a semantic heading and asynchronously load the snapshot so the route test has a stable target.

- [ ] **Step 4: Run route tests and build**

Run:

```bash
cd frontend
pnpm --filter @mini-auth/web test -- src/App.test.tsx
pnpm --filter @mini-auth/web build
```

Expected: both commands exit 0 and the existing `/` login path still compiles.

- [ ] **Step 5: Commit routing**

```bash
git add frontend/apps/web/src/App.tsx frontend/apps/web/src/App.test.tsx frontend/apps/web/src/security-center/SecurityCenterPage.tsx
git commit -m "Add security center web routes"
```

### Task 3: Interactive Security Center Page

**Files:**
- Modify: `frontend/apps/web/src/security-center/SecurityCenterPage.tsx`
- Create: `frontend/apps/web/src/security-center/SecurityCenterPage.test.tsx`

**Interfaces:**
- Consumes: all `SecurityCenterDataSource` methods from Task 1.
- Preserves: `SecurityCenterPage({ dataSource }: { dataSource: SecurityCenterDataSource })` from Task 2.

- [ ] **Step 1: Write failing loading and content tests**

Render with a controllable fake source and assert:

```ts
expect(screen.getByText("正在加载安全中心…")).toBeInTheDocument();
await screen.findByRole("heading", { name: "你好，Mini Auth 用户" });
expect(screen.getByText("账号安全体检分")).toBeInTheDocument();
expect(screen.getByText("账号保护")).toBeInTheDocument();
expect(screen.getByText("登录设备")).toBeInTheDocument();
```

Add a rejected-load test requiring an error panel and a “重新加载” button.

- [ ] **Step 2: Write failing interaction tests**

Require the following flows:

- Click the two-step switch, await `setTwoFactorEnabled(true)`, then see score `82` and status `已设置`.
- Click Safari’s “退出登录”, confirm in the dialog, await `revokeDevice("safari-iphone")`, and see Safari removed plus a success toast.
- Click “操作记录” and see operation history in an accessible dialog.
- Click “应用授权管理” and see authorized applications after asynchronous loading.
- Press `Escape` to close a dialog.
- Click “前往优化” and verify focus moves to the first unset protection item.

- [ ] **Step 3: Run page tests and verify failure**

Run:

```bash
cd frontend
pnpm --filter @mini-auth/web test -- src/security-center/SecurityCenterPage.test.tsx
```

Expected: FAIL because the full content and interactions are not implemented.

- [ ] **Step 4: Build the semantic page shell**

Implement header, greeting, score card, device card, account-management card, protection card, authorization card, guidance card, and footer. Use small local components such as `Panel`, `LineIcon`, `SettingRow`, `DeviceRow`, `Modal`, and `Toast`; keep data access in `SecurityCenterPage`.

- [ ] **Step 5: Implement async state and interactions**

Add explicit states for initial loading, load error, pending operation ID, active dialog, pending device revocation, and toast. Use the injected data source for every read or mutation. Provide dialog close behavior through button, backdrop, and `Escape`; provide `role="switch"` and `aria-checked` for two-step verification.

- [ ] **Step 6: Run page tests and full tests**

Run:

```bash
cd frontend
pnpm --filter @mini-auth/web test -- src/security-center/SecurityCenterPage.test.tsx
pnpm --filter @mini-auth/web test
```

Expected: all tests pass.

- [ ] **Step 7: Commit interactions**

```bash
git add frontend/apps/web/src/security-center/SecurityCenterPage.tsx frontend/apps/web/src/security-center/SecurityCenterPage.test.tsx
git commit -m "Build interactive security center page"
```

### Task 4: Feishu-Inspired PC Visual System and Browser Verification

**Files:**
- Create: `frontend/apps/web/src/security-center/security-center.css`
- Modify: `frontend/apps/web/src/security-center/SecurityCenterPage.tsx`

**Interfaces:**
- Consumes: semantic class names and components from Task 3.
- Produces: isolated `.security-*` CSS rules and the finished PC layout.

- [ ] **Step 1: Capture the unstyled baseline**

Run the development server:

```bash
cd frontend
pnpm --filter @mini-auth/web dev --host 127.0.0.1
```

Open `http://127.0.0.1:5173/accounts/security/` and record the unstyled state. Confirm no security-center styles leak into the existing `/` login page.

- [ ] **Step 2: Implement the visual system**

Create scoped CSS for:

- A 64px white top bar, pale gray-blue page background, and subtle top gradient.
- A centered content width near 1440px and two columns with a 24px gap.
- White 12px-radius cards with restrained borders/shadows and 28–32px padding.
- A CSS/SVG semicircle score gauge, blue primary button, orange unset badges, gray set badges, red danger action, line icons, toggle, dialogs, toast, focus rings, hover states, and reduced-motion behavior.
- A PC minimum content width that keeps the two columns intact rather than introducing a mobile stack.

Set `document.title` to `Mini Auth 账号安全中心` in a security-page effect and restore the previous title on unmount so the login route keeps its existing title.

- [ ] **Step 3: Run automated verification**

Run:

```bash
cd frontend
pnpm --filter @mini-auth/web test
pnpm --filter @mini-auth/web build
```

Expected: all tests pass and the production bundle completes without TypeScript errors.

- [ ] **Step 4: Verify in the browser against the references**

At a viewport near 2048×1236, verify:

- Header, greeting, and first card row match the reference hierarchy.
- Both columns align, cards have consistent radii and gutters, and the right protection card density matches the reference.
- Text sizes, muted descriptions, blue actions, orange tags, and bottom account line match the intended visual weight.
- Toggle, optimize focus, device confirmation/removal, operation history, authorization list, settings dialogs, backdrop close, and `Escape` close all work.
- `/` still renders the existing login screen and the browser console has no errors.

Fix any visual or runtime discrepancies and repeat the build and browser checks.

- [ ] **Step 5: Commit the finished page**

```bash
git add frontend/apps/web/src/security-center/security-center.css frontend/apps/web/src/security-center/SecurityCenterPage.tsx
git commit -m "Style PC account security center"
```

### Task 5: Final Regression and Scope Audit

**Files:**
- Modify only files from Tasks 1–4 if verification exposes an issue.

**Interfaces:**
- Verifies the complete security-center feature without introducing new interfaces.

- [ ] **Step 1: Run final automated checks**

Run:

```bash
cd frontend
pnpm --filter @mini-auth/web test
pnpm --filter @mini-auth/web build
git diff --check HEAD~4
```

Expected: tests and build exit 0; diff check prints no whitespace errors.

- [ ] **Step 2: Audit scope and repository status**

Run:

```bash
git status --short
git diff --stat HEAD~4
```

Confirm implementation changes are limited to `frontend/apps/web/src`, the Web test configuration/package metadata required to run tests, and the lockfile. Do not stage or alter pre-existing untracked files.

- [ ] **Step 3: Record final evidence**

Capture the passing test count, successful build output, inspected security-center URL, inspected viewport, and any known limitation. If Task 5 required a fix, stage only the changed implementation files from this explicit list and commit them:

```bash
git add frontend/apps/web/src/App.tsx frontend/apps/web/src/App.test.tsx frontend/apps/web/src/security-center frontend/apps/web/vite.config.ts frontend/apps/web/tsconfig.json frontend/apps/web/package.json frontend/pnpm-lock.yaml
git commit -m "Fix security center verification issues"
```
