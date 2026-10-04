# E2E Smoke Tests (tester.army `e2e`) and Handover Prep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove with automated browser tests that the app works in both modes (email forwarding configured / not configured) after the Polar removal, then finish the remaining handover items (security review, repo cleanup, license decision).

**Architecture:** `e2e` (TesterArmy, open source TypeScript runner on Playwright) drives the real app. Tests are **deterministic** (locators + `expect`) so they need no model API key; `agent.*` AI steps are not used. Two config files = two app instances started from one production build: `e2e.config.ts` (email intake ON, normal `.env.local`) and `e2e.email-off.config.ts` (the three email keys blanked). Local Supabase (Docker) provides the database; login uses the project's seeded local admin from `supabase/seed.sql`.

**Tech Stack:** `e2e` + `@e2e-dev/web` (Playwright/Chromium), Next.js 16 (`next start`), local Supabase CLI, Node 22.12+ (machine has v25).

**Spec:** Docs read 2026-10-04: https://e2e.tester.army/docs/ (quickstart, reference/config, reference/cli, authentication, browser). Related plans: `2026-10-04-remove-polar-billing.md`, `2026-10-04-optional-email-intake.md`.

## Global Constraints

- **Local only.** Tests run against `http://127.0.0.1` + local Supabase (`http://127.0.0.1:54321`). Never point them at the hosted Supabase project, and never run against production.
- **No real inbox creation.** Do NOT click "Create forwarding address" in a test — with real AgentMail keys in `.env.local` it would create a real inbox (and consume the free 3-inbox quota). Only assert the button is visible.
- **The upload test calls the real LLM provider** (`EXTRACTION_PROVIDER` in `.env.local`, currently Google). It is tagged `llm` and costs a few cents per run; exclude with `--exclude-tag llm`.
- **No data deletion**: do not run `supabase db reset` (it would wipe the developer's local data). Tests only add rows for the seeded admin user.
- e2e does **not** load `.env` files by itself; shell env or `process.loadEnvFile()` in config. The app (`next start`) still loads `.env.local` on its own.
- Test credentials are the local seed's (`supabase/seed.sql`), referenced through `credentials` config, never hardcoded in test files.
- Commit messages end with: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`

---

### Task 1: Install and scaffold e2e

**Files:**
- Modify: `package.json`, `package-lock.json`, `.gitignore`
- Create: `e2e.config.ts`, `e2e.email-off.config.ts`, `tests/support/app-command.ts`
- Create: `tests/smoke.e2e.ts` (placeholder removed in Task 3)

- [ ] **Step 1: Install**

```bash
npm i -D e2e @e2e-dev/web
npx e2e-web install chromium
```

Expected: both packages in `devDependencies`; Chromium downloaded. (If the package names differ from the docs' imports `e2e` / `@e2e-dev/web`, run `npx e2e init` in a scratch dir and copy the names it writes.)

- [ ] **Step 2: `.gitignore`** — append:

```
# e2e runner output
/.e2e/
```

- [ ] **Step 3: Shared server command** — `tests/support/app-command.ts`:

```ts
// Both configs start the SAME production build on a free port; only env differs.
// `next start` (not `next dev`) so the two instances don't fight over the .next/dev lock.
export function appCommand(env: Record<string, string> = {}) {
  return {
    executable: "npx",
    args: ["next", "start", "-p", "{port}"],
    env: { ...env },
  } as const;
}

export const EMAIL_KEYS_OFF = {
  AGENTMAIL_API_KEY: "",
  AGENTMAIL_WEBHOOK_SECRET: "",
  TRIGGER_SECRET_KEY: "",
} as const;

export const ADMIN_CREDENTIALS = {
  admin: {
    username: process.env.E2E_USER_ADMIN_USERNAME ?? "admin@local.test",
    password: process.env.E2E_USER_ADMIN_PASSWORD ?? "admin12345",
  },
};
```

(The fallbacks are the values already committed in `supabase/seed.sql`, a local-dev-only seed.)

- [ ] **Step 4: `e2e.config.ts`** (email ON):

```ts
import type { E2EConfig } from "e2e";
import { web } from "@e2e-dev/web";
import { ADMIN_CREDENTIALS, appCommand } from "./tests/support/app-command";

export default {
  targets: [
    {
      name: "email-on",
      engine: web({ browser: "chromium" }),
      app: {
        url: "http://127.0.0.1:0",
        command: appCommand(),
        readyUrl: "http://127.0.0.1:{port}/api/health",
      },
    },
  ],
  tests: ["tests/**/*.e2e.ts", "!tests/email-off/**"],
  credentials: ADMIN_CREDENTIALS,
  retries: 0,
  workers: 1,
  trace: "on-first-retry",
  video: "retain-on-failure",
  reporters: ["list", "markdown"],
} satisfies E2EConfig;
```

- [ ] **Step 5: `e2e.email-off.config.ts`**:

```ts
import type { E2EConfig } from "e2e";
import { web } from "@e2e-dev/web";
import { ADMIN_CREDENTIALS, appCommand, EMAIL_KEYS_OFF } from "./tests/support/app-command";

export default {
  targets: [
    {
      name: "email-off",
      engine: web({ browser: "chromium" }),
      app: {
        url: "http://127.0.0.1:0",
        command: appCommand(EMAIL_KEYS_OFF),
        readyUrl: "http://127.0.0.1:{port}/api/health",
      },
    },
  ],
  tests: ["tests/email-off/**/*.e2e.ts", "tests/auth.setup.e2e.ts"],
  credentials: ADMIN_CREDENTIALS,
  retries: 0,
  workers: 1,
  output: ".e2e/email-off",
  reporters: ["list", "markdown"],
} satisfies E2EConfig;
```

- [ ] **Step 6: Placeholder test + prerequisites**

`tests/smoke.e2e.ts`:

```ts
import { test } from "@e2e-dev/web";
import { expect } from "e2e";

test("landing page opens", async ({ app, browser }) => {
  await app.open("/");
  await expect(browser.locator("body")).toBeVisible();
});
```

Prerequisites (run once, in order): `npx supabase start` (needs Docker running), `npm run build`.

Run: `npx e2e run`
Expected: 1 test PASS. If config validation demands an `agents` model even with no agent steps, add `agents: { default: { model: <any configured model> } }` to both configs and note it in the commit message; if it still needs an API key only when an agent step runs, leave it.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .gitignore e2e.config.ts e2e.email-off.config.ts tests
git commit -m "test: add e2e (TesterArmy) scaffold with email-on and email-off targets

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Login setup (reusable session)

**Files:**
- Create: `tests/auth.setup.e2e.ts`

**Interfaces:**
- Produces: saved session named `admin`, consumed with `{ session: 'admin' }` by Tasks 3–4. (Login form: label `Email`, label `Password`, button `Sign in`, redirects to `/dashboard`.)

- [ ] **Step 1: Write the setup**

```ts
import { test } from "@e2e-dev/web";
import { expect, credentials } from "e2e";

test.setup("authenticate as admin", { sessions: ["admin"] }, async ({ app, screen, session, browser }) => {
  const admin = credentials.user("admin");

  await app.open("/login");
  await screen.getByLabel("Email").fill(admin.username);
  await screen.getByLabel("Password").fill(admin.password);
  await screen.getByRole("button", "Sign in").tap();

  await expect(browser).toHaveURL("/dashboard");
  await session.save("admin");
});
```

- [ ] **Step 2: Run it**

Run: `npx e2e run tests/auth.setup.e2e.ts`
Expected: PASS and a saved `admin` session. If it fails, check the seed user exists (Supabase Studio at http://127.0.0.1:54323 → Authentication) and that `.env.local` points at the local Supabase URL.

- [ ] **Step 3: Commit**

```bash
git add tests/auth.setup.e2e.ts
git commit -m "test: e2e login setup with reusable admin session

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Email-ON suite (default config)

**Files:**
- Delete: `tests/smoke.e2e.ts`
- Create: `tests/public.e2e.ts`, `tests/dashboard.e2e.ts`, `tests/upload.e2e.ts`, `tests/fixtures/make-invoice-pdf.mjs`

- [ ] **Step 1: Public pages — no billing remnants**

`tests/public.e2e.ts`:

```ts
import { test } from "@e2e-dev/web";
import { expect } from "e2e";

test("landing page has no pricing section or Polar mentions", async ({ app, browser }) => {
  await app.open("/");
  await expect(browser.locator("body")).toBeVisible();
  await expect(browser.locator("#pricing")).toHaveCount(0);
  await expect(browser.locator("body")).not.toContainText("Polar");
});

test("terms page no longer names a payment processor", async ({ app, browser }) => {
  await app.open("/terms");
  await expect(browser.locator("body")).not.toContainText("Polar");
});
```

- [ ] **Step 2: Dashboard — every feature unlocked**

`tests/dashboard.e2e.ts`:

```ts
import { test } from "@e2e-dev/web";
import { expect } from "e2e";

test("sidebar shows Automation when email intake is configured", { session: "admin" }, async ({ app, screen }) => {
  await app.open("/dashboard");
  await expect(screen.getByRole("link", "Automation")).toBeVisible();
});

test("settings has no billing card and shows the forwarding card", { session: "admin" }, async ({ app, browser }) => {
  await app.open("/dashboard/settings");
  await expect(browser.locator("body")).toContainText("Forwarding address");
  await expect(browser.locator("body")).not.toContainText("Billing");
  await expect(browser.locator("body")).not.toContainText("Team plan");
  await expect(browser.locator("body")).not.toContainText("Upgrade");
});

test("exports page is open to everyone (no upgrade gate)", { session: "admin" }, async ({ app, browser, screen }) => {
  await app.open("/dashboard/exports");
  await expect(browser.locator("body")).not.toContainText("Team plan");
  await expect(screen.getByRole("link", "Download CSV")).toBeVisible();
});

test("CSV export downloads", { session: "admin" }, async ({ app, browser, screen }) => {
  await app.open("/dashboard/exports");
  const file = await browser.waitForDownload(() => screen.getByRole("link", "Download CSV").tap());
  expect(file.path).toMatch(/invoices-\d{4}-\d{2}-\d{2}\.csv$/);
});

test("automation page offers to create a forwarding address", { session: "admin" }, async ({ app, browser }) => {
  await app.open("/dashboard/automation");
  await expect(browser.locator("body")).not.toContainText("Upgrade");
  // Visible only — never click it: with real AgentMail keys this creates a real inbox.
  await expect(browser.locator("body")).toContainText(/forwarding address/i);
});
```

(The export link's accessible name and the automation text are inferred from `exports-panel.tsx` / `connection-panel.tsx`; the run in Step 5 confirms or corrects them.)

- [ ] **Step 3: Upload — real extraction (tagged `llm`)**

`tests/fixtures/make-invoice-pdf.mjs` (generates a tiny text PDF; run once, commit the output):

```js
import { writeFileSync } from "node:fs";

const lines = [
  "INVOICE",
  "Vendor: Acme Test Supplies Ltd",
  "Invoice number: E2E-0001",
  "Issue date: 2026-09-15",
  "Description: Office supplies",
  "Total due: 123.45 USD",
];
const text = lines.map((l, i) => `BT /F1 14 Tf 72 ${760 - i * 24} Td (${l}) Tj ET`).join("\n");
const objs = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
  `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
];
let pdf = "%PDF-1.4\n";
const offsets = [];
objs.forEach((o, i) => {
  offsets.push(pdf.length);
  pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
});
const xref = pdf.length;
pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
offsets.forEach((o) => (pdf += `${String(o).padStart(10, "0")} 00000 n \n`));
pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
writeFileSync(new URL("./invoice-sample.pdf", import.meta.url), pdf);
```

Run: `node tests/fixtures/make-invoice-pdf.mjs`

`tests/upload.e2e.ts`:

```ts
import { test } from "@e2e-dev/web";
import { expect } from "e2e";

test("uploading a PDF extracts it with no quota or plan limit", { session: "admin", tags: ["llm"] }, async ({ app, browser, screen }) => {
  await app.open("/dashboard/invoices");
  await browser.locator('input[type="file"]').setInputFiles("tests/fixtures/invoice-sample.pdf");
  await screen.getByRole("button", /Upload & extract/).tap();

  await expect(browser.locator("body")).toContainText("Acme Test Supplies", { timeout: 90_000 });
  await expect(browser.locator("body")).not.toContainText("monthly invoice limit");
});
```

(Re-running the same fixture hits the duplicate-by-hash path and still shows the vendor — safe to repeat.)

- [ ] **Step 4: Remove the placeholder**

```bash
git rm tests/smoke.e2e.ts
```

- [ ] **Step 5: Run and fix selectors**

Run: `npx e2e run --reporter list` (add `--headed` to watch).
Expected: all PASS. For any failure, open `.e2e/` trace/screenshot, correct **only the test selector or expected text** (not the app) — unless the failure reveals a genuine app bug, in which case stop and report it. Re-run until green. Then confirm the cheap subset works without the LLM: `npx e2e run --exclude-tag llm`.

- [ ] **Step 6: Commit**

```bash
git add tests
git commit -m "test: e2e suite for email-on mode (public, dashboard, export, upload)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Email-OFF suite

**Files:**
- Create: `tests/email-off/email-off.e2e.ts`

- [ ] **Step 1: Write the tests**

```ts
import { test } from "@e2e-dev/web";
import { expect } from "e2e";

test("app boots and signs in with email intake unconfigured; Automation is hidden", { session: "admin" }, async ({ app, browser }) => {
  await app.open("/dashboard");
  await expect(browser.locator("nav, aside").first()).toBeVisible();
  await expect(browser.locator("body")).not.toContainText("Automation");
});

test("/dashboard/automation is 404 when email intake is unconfigured", { session: "admin" }, async ({ app, browser }) => {
  await app.open("/dashboard/automation");
  await expect(browser.locator("body")).toContainText(/not found|404/i);
});

test("settings has no forwarding card", { session: "admin" }, async ({ app, browser }) => {
  await app.open("/dashboard/settings");
  await expect(browser.locator("body")).not.toContainText("Forwarding address");
});

test("AgentMail webhook returns 404 when unconfigured", async ({ app, browser }) => {
  await app.open("/");
  const status = await browser.evaluate(async () => (await fetch("/api/webhooks/agentmail", { method: "POST", body: "{}" })).status);
  expect(status).toBe(404);
});
```

- [ ] **Step 2: Run the email-off config**

Run: `npx e2e run --config e2e.email-off.config.ts`
Expected: all PASS. If "Automation hidden" fails, first confirm the blanked env reached the server: `curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:<port>/api/webhooks/agentmail` must be 404 (Next never overrides an already-set — even empty — process env var with `.env.local`).

- [ ] **Step 3: Commit**

```bash
git add tests/email-off
git commit -m "test: e2e suite for email-off mode

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Document and wire into the workflow

**Files:**
- Modify: `package.json` (scripts), `docs/DEVELOPMENT.md`, `.claude/rules/testing.md`

- [ ] **Step 1: Scripts** — add to `package.json` `scripts`:

```json
"test:e2e": "e2e run --exclude-tag llm",
"test:e2e:full": "e2e run",
"test:e2e:email-off": "e2e run --config e2e.email-off.config.ts"
```

- [ ] **Step 2: Docs** — in `docs/DEVELOPMENT.md` add an "E2E" section: prerequisites (Docker, `npx supabase start`, `npm run build`, `npx e2e-web install chromium`), the three scripts, that `llm`-tagged tests spend real LLM money, and that tests must never click "Create forwarding address". In `.claude/rules/testing.md`, replace the sentence saying UI/routes are "verified manually only" with: UI flows are covered by `npm run test:e2e` (deterministic, no model key needed); keep manual smoke only for new UI not yet covered.

- [ ] **Step 3: Final run + commit**

Run: `npm run test && npx tsc --noEmit && npm run lint && npm run test:e2e && npm run test:e2e:email-off`
Expected: all green.

```bash
git add -A
git commit -m "docs: document e2e workflow and scripts

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Security review

- [x] **Step 1:** Run the `security-review` skill over the whole of `main` since commit `28d31c1` (all changes of this round). Focus: webhook auth (`/api/webhooks/agentmail` signature + 404 gate), the new env refinements, service-role client usage in `createInbox`, upload route (rate limit, content-type, size), RLS/grants untouched.
- [x] **Step 2:** Fix every HIGH/MEDIUM finding with a test where `src/lib/` logic is involved; list LOW findings in `docs/SETUP.md` under "Known limitations".
- [x] **Step 3:** Commit: `git commit -am "fix: address security review findings"` (skip if none).

**Result (2026-10-04):** no findings. Exports, upload, `createInbox`, the AgentMail webhook (404 gate → size limits → svix verify), and the lazy AgentMail client are all still authenticated and scoped to the session user. Low-confidence notes: (1) upload has no plan/quota cap by design, only the per-user rate limit, which is a no-op without Upstash; this is already documented in `docs/SETUP.md` → "Recommended before going public", so no new section was added. (2) The empty `src/app/api/webhooks/lemonsqueezy/` directory was deleted (it was untracked, so there was nothing to commit).

---

### Task 7: Handover prep

- [x] **Step 1: Repo hygiene** — confirm `git status` is clean, no `.env*` tracked (`git ls-files | grep -i "\.env"` shows only `.env.local.example`), no personal files in the repo root. (2026-10-04: clean. Tracked internal files to decide on in Step 2: `.mcp.json` (contains the local path `D:\Project\invoice`, no secrets), `skills-lock.json`, and about 70 files under `docs/superpowers/`, `.claude/`, `.agents/`, `.cursor/`.)
- [x] **Step 2: Decide what ships** (ask the owner): keep or strip `docs/superpowers/` and `.claude/` from the buyer copy; they are internal workflow, not product. (2026-10-04: owner chose strip. Done on branch `handover` (worktree `.claude/worktrees/handover`, commit `11118b3`): removed `docs/superpowers/`, `.claude/`, `.cursor/`, `.mcp.json`, `skills-lock.json`, `CLAUDE.md`; rewrote `docs/DEVELOPMENT.md` without the AI-workflow parts; removed dangling links in `README.md` and `docs/*.md`. `main` keeps everything. Rebuild `handover` from `main` (`git rebase main` or redo) if `main` changes before delivery.)
- [x] **Step 3: Trigger.dev project ref** (done on `handover`) — in the **handover copy only** (not `main`, or the owner's own deploy breaks), change `project: "proj_glkyuruvgwugfznpnrxd"` in `trigger.config.ts` to `"proj_REPLACE_WITH_YOUR_PROJECT_REF"`.
- [ ] **Step 4: License** — requires the owner's decision; do not invent legal terms. Options: (a) add a proprietary `LICENSE` stating the buyer receives all rights upon payment, (b) a permissive license (MIT) if the buyer may resell, (c) a separate signed sale agreement and no `LICENSE` file. Record the choice in `docs/SETUP.md`. (2026-10-04: owner has not decided yet; blocks Step 5.)
- [ ] **Step 5: Tag the release** — `git tag v1.0.0-handover` after the final green run.

---

## Self-Review

- **Spec coverage:** e2e via tester.army (Tasks 1–5), both email modes (Tasks 3–4), the three smoke scenarios from the earlier list (Task 3–4), security review (6), trigger ref / cleanup / license (7).
- **Placeholder scan:** selectors and some expected strings are inferred from source; Task 3 Step 5 and Task 4 Step 2 are explicit "run, then correct the test" gates. Task 1 Step 6 documents the one config uncertainty (whether `agents` is required without agent steps).
- **Type consistency:** session name `admin` and credentials key `admin` match across `app-command.ts`, `auth.setup.e2e.ts`, and all `{ session: "admin" }` usages; `appCommand` / `EMAIL_KEYS_OFF` / `ADMIN_CREDENTIALS` names match in both configs.
- **Known unknowns:** exact API of `tags`, `browser.evaluate`, and `toHaveCount` was not verified against the e2e docs (only quickstart/config/cli/auth/browser were read); if a call is rejected, check https://e2e.tester.army/docs/llms.txt for the page that defines it.
