# Optional Email Intake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the app boot and be fully usable with only Supabase + one LLM key. Email forwarding (AgentMail + Trigger.dev) becomes an opt-in feature that is hidden when not configured.

**Architecture:** One pure helper, `isEmailIntakeConfigured(env)`, is the single source of truth. Env validation, the server action, the sidebar and the Automation/Settings UI all branch on it. Upload-and-extract never touches Trigger.dev (verified: the upload route calls `extractInvoice` directly; `@trigger.dev/sdk` is imported only by `src/app/api/webhooks/agentmail/route.ts` and `src/trigger/*`), so no change is needed there.

**Tech Stack:** Next.js 16 (App Router), Zod 4, Vitest, AgentMail SDK, Trigger.dev v4.

**Spec:** Decision made in conversation 2026-10-04 (sell source; buyer should run it in ~10 minutes). Companion plan: `docs/superpowers/plans/2026-10-04-remove-polar-billing.md` (independent; either order works, but run that one first to avoid conflicts in `actions.ts`, `settings/page.tsx`, `automation/*`).

## Global Constraints

- Email intake is **configured** only when all three are non-empty: `AGENTMAIL_API_KEY`, `AGENTMAIL_WEBHOOK_SECRET`, `TRIGGER_SECRET_KEY`.
- **Partial configuration is an error** at boot (e.g. `AGENTMAIL_API_KEY` set but `TRIGGER_SECRET_KEY` missing) — a half-configured inbox silently drops customer mail, which is worse than failing loudly.
- Pure logic lives in `src/lib/`, with a `.test.ts` shipped in the same commit (`.claude/rules/testing.md`). Names/constants follow `.claude/rules/naming.md` and `.claude/rules/constants.md`.
- Do not delete data or migrations. The `inboxes` table and existing inboxes keep working.
- Quality gate before each commit: `npm run test && npx tsc --noEmit`.
- Work in a worktree: `git worktree add -b feat/optional-email .claude/worktrees/optional-email`.
- Commit messages end with: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`

---

### Task 1: `isEmailIntakeConfigured` helper

**Files:**
- Create: `src/lib/email-intake.ts`
- Create: `src/lib/email-intake.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const EMAIL_INTAKE_ENV_KEYS = ["AGENTMAIL_API_KEY", "AGENTMAIL_WEBHOOK_SECRET", "TRIGGER_SECRET_KEY"] as const;
  export type EmailIntakeEnvKey = (typeof EMAIL_INTAKE_ENV_KEYS)[number];
  export type EmailIntakeEnv = Partial<Record<EmailIntakeEnvKey, string | undefined>>;
  export function isEmailIntakeConfigured(env: EmailIntakeEnv): boolean;
  export function missingEmailIntakeKeys(env: EmailIntakeEnv): EmailIntakeEnvKey[];
  ```

- [ ] **Step 1: Write the failing test**

`src/lib/email-intake.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isEmailIntakeConfigured, missingEmailIntakeKeys } from "./email-intake";

const full = {
  AGENTMAIL_API_KEY: "am-key",
  AGENTMAIL_WEBHOOK_SECRET: "whsec",
  TRIGGER_SECRET_KEY: "tr-key",
};

describe("isEmailIntakeConfigured", () => {
  it("is true when all three keys are set", () => {
    expect(isEmailIntakeConfigured(full)).toBe(true);
  });

  it("is false when nothing is set", () => {
    expect(isEmailIntakeConfigured({})).toBe(false);
  });

  it("is false when any one key is missing", () => {
    expect(isEmailIntakeConfigured({ ...full, TRIGGER_SECRET_KEY: undefined })).toBe(false);
    expect(isEmailIntakeConfigured({ ...full, AGENTMAIL_API_KEY: undefined })).toBe(false);
    expect(isEmailIntakeConfigured({ ...full, AGENTMAIL_WEBHOOK_SECRET: undefined })).toBe(false);
  });

  it("treats empty and whitespace-only values as unset", () => {
    expect(isEmailIntakeConfigured({ ...full, AGENTMAIL_API_KEY: "" })).toBe(false);
    expect(isEmailIntakeConfigured({ ...full, AGENTMAIL_API_KEY: "   " })).toBe(false);
  });
});

describe("missingEmailIntakeKeys", () => {
  it("lists nothing when fully configured", () => {
    expect(missingEmailIntakeKeys(full)).toEqual([]);
  });

  it("lists every missing key in declared order", () => {
    expect(missingEmailIntakeKeys({ AGENTMAIL_WEBHOOK_SECRET: "x" })).toEqual([
      "AGENTMAIL_API_KEY",
      "TRIGGER_SECRET_KEY",
    ]);
  });
});
```

- [ ] **Step 2: Run, confirm it fails**

Run: `npx vitest run src/lib/email-intake.test.ts`
Expected: FAIL — module `./email-intake` not found.

- [ ] **Step 3: Implement**

`src/lib/email-intake.ts`:

```ts
export const EMAIL_INTAKE_ENV_KEYS = [
  "AGENTMAIL_API_KEY",
  "AGENTMAIL_WEBHOOK_SECRET",
  "TRIGGER_SECRET_KEY",
] as const;

export type EmailIntakeEnvKey = (typeof EMAIL_INTAKE_ENV_KEYS)[number];
export type EmailIntakeEnv = Partial<Record<EmailIntakeEnvKey, string | undefined>>;

function isSet(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function missingEmailIntakeKeys(env: EmailIntakeEnv): EmailIntakeEnvKey[] {
  return EMAIL_INTAKE_ENV_KEYS.filter((key) => !isSet(env[key]));
}

/** True only when every key needed to receive and process forwarded email is set. */
export function isEmailIntakeConfigured(env: EmailIntakeEnv): boolean {
  return missingEmailIntakeKeys(env).length === 0;
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `npx vitest run src/lib/email-intake.test.ts` — Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/email-intake.ts src/lib/email-intake.test.ts
git commit -m "feat: add isEmailIntakeConfigured helper

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Make AgentMail/Trigger env optional, reject partial config

**Files:**
- Modify: `src/lib/validation/env.ts`
- Modify: `src/lib/validation/env.test.ts`

**Interfaces:**
- Consumes: `missingEmailIntakeKeys`, `EMAIL_INTAKE_ENV_KEYS` from `@/lib/email-intake`.
- Produces: env schema where the three keys are optional but all-or-nothing.

- [ ] **Step 1: Update tests first**

In `src/lib/validation/env.test.ts`, remove `AGENTMAIL_API_KEY` and `AGENTMAIL_WEBHOOK_SECRET` from `validBase` (and delete any existing test that expects them to be *required*). Then add:

```ts
describe("email intake env (optional, all-or-nothing)", () => {
  const baseWithLlm = { ...validBase, ANTHROPIC_API_KEY: "sk-ant-x" };

  it("accepts an environment with no email intake keys at all", () => {
    expect(parseEnvInput(baseWithLlm).success).toBe(true);
  });

  it("accepts a fully configured email intake", () => {
    const result = parseEnvInput({
      ...baseWithLlm,
      AGENTMAIL_API_KEY: "am",
      AGENTMAIL_WEBHOOK_SECRET: "whsec",
      TRIGGER_SECRET_KEY: "tr",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a partially configured email intake and names the missing keys", () => {
    const result = parseEnvInput({ ...baseWithLlm, AGENTMAIL_API_KEY: "am" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/AGENTMAIL_WEBHOOK_SECRET/);
      expect(result.error).toMatch(/TRIGGER_SECRET_KEY/);
    }
  });
});
```

Run: `npx vitest run src/lib/validation/env.test.ts`
Expected: the first and third new tests FAIL / existing tests fail (schema still requires the AgentMail keys).

- [ ] **Step 2: Change the schema**

In `src/lib/validation/env.ts` add `import { EMAIL_INTAKE_ENV_KEYS, missingEmailIntakeKeys } from "@/lib/email-intake";`, then replace the two required AgentMail lines with:

```ts
    // Email intake (forwarded invoices). Optional as a group — see superRefine below.
    AGENTMAIL_API_KEY: z.string().optional(),
    AGENTMAIL_WEBHOOK_SECRET: z.string().optional(),
    TRIGGER_SECRET_KEY: z.string().optional(),
```

and append to the `.superRefine` chain:

```ts
  .superRefine((env, ctx) => {
    const anySet = EMAIL_INTAKE_ENV_KEYS.some((key) => (env[key] ?? "").trim().length > 0);
    if (!anySet) return;
    const missing = missingEmailIntakeKeys(env);
    if (missing.length > 0) {
      ctx.addIssue({
        code: "custom",
        message: `Email intake is partially configured — also set: ${missing.join(", ")} (or unset all of ${EMAIL_INTAKE_ENV_KEYS.join(", ")}).`,
      });
    }
  });
```

(Keep it as the last `.superRefine` before `export type EnvConfig`; if the Polar plan already ran, the chain ends after the provider refine — append there.)

- [ ] **Step 3: Run tests**

Run: `npm run test && npx tsc --noEmit` — Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/validation/env.ts src/lib/validation/env.test.ts
git commit -m "feat: make AgentMail and Trigger.dev env optional (all-or-nothing)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Lazy AgentMail client and guarded `createInbox`

`src/lib/agentmail.ts` builds `new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY! })` at import time, and `actions.ts` imports it — so a missing key would break every dashboard action. Make it lazy and guard the action.

**Files:**
- Modify: `src/lib/agentmail.ts`
- Modify: `src/app/dashboard/actions.ts`
- Modify: `src/app/api/webhooks/agentmail/route.ts`

**Interfaces:**
- Produces: `getAgentMailClient(): AgentMailClient` (throws if key unset); `createUserInbox(userId)` unchanged signature. `createInbox()` returns `{ ok: false, error: "Email forwarding is not configured on this instance." }` when not configured.

- [ ] **Step 1: Make the client lazy**

In `src/lib/agentmail.ts` replace the top-level `export const agentmail = new AgentMailClient(...)` with:

```ts
let client: AgentMailClient | null = null;

/** Built on first use so the app can boot without AgentMail configured. */
export function getAgentMailClient(): AgentMailClient {
  if (client) return client;
  const apiKey = process.env.AGENTMAIL_API_KEY;
  if (!apiKey) throw new Error("AGENTMAIL_API_KEY is not set");
  client = new AgentMailClient({ apiKey });
  return client;
}
```

and change the two uses (`agentmail.inboxes.list`, `agentmail.inboxes.create`) to `getAgentMailClient().inboxes.list` / `.create`. Run `grep -rn "from \"@/lib/agentmail\"" src` — only `actions.ts` imports it today; if another file imports the removed `agentmail` export, switch it to `getAgentMailClient()`.

- [ ] **Step 2: Guard `createInbox`**

In `src/app/dashboard/actions.ts` add `import { isEmailIntakeConfigured } from "@/lib/email-intake";` and, directly after `if (!user) redirect("/login");` in `createInbox`, insert:

```ts
  if (!isEmailIntakeConfigured(process.env)) {
    return { ok: false, error: "Email forwarding is not configured on this instance." };
  }
```

- [ ] **Step 3: Webhook returns 404 when disabled**

In `src/app/api/webhooks/agentmail/route.ts` add `import { isEmailIntakeConfigured } from "@/lib/email-intake";` and make it the first statement of `POST`:

```ts
  if (!isEmailIntakeConfigured(process.env)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
```

- [ ] **Step 4: Verify and commit**

Run: `npm run test && npx tsc --noEmit && npm run lint` — Expected: PASS.

```bash
git add -A
git commit -m "feat: lazy AgentMail client; disable inbox creation and webhook when unconfigured

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Hide email UI when not configured

**Files:**
- Modify: `src/lib/nav-config.ts`, `src/lib/nav-config.test.ts`
- Modify: `src/components/dashboard/app-sidebar.tsx`
- Modify: `src/app/dashboard/layout.tsx`
- Modify: `src/app/dashboard/automation/page.tsx`
- Modify: `src/app/dashboard/settings/page.tsx`

**Interfaces:**
- Produces: `NavItem.requiresEmailIntake?: boolean` and `getNavGroups(options: { isEmailIntakeEnabled: boolean }): NavGroup[]`. `AppSidebar` takes prop `{ isEmailIntakeEnabled: boolean }`.

- [ ] **Step 1: Write the failing nav test**

Append to `src/lib/nav-config.test.ts` (and add `getNavGroups` to the import):

```ts
describe("getNavGroups", () => {
  const labels = (enabled: boolean) =>
    getNavGroups({ isEmailIntakeEnabled: enabled }).flatMap((g) => g.items.map((i) => i.label));

  it("includes Automation when email intake is enabled", () => {
    expect(labels(true)).toContain("Automation");
  });

  it("hides Automation when email intake is disabled", () => {
    expect(labels(false)).not.toContain("Automation");
  });

  it("keeps all other items either way", () => {
    expect(labels(false)).toEqual(expect.arrayContaining(["Overview", "Invoices", "Vendors", "Analytics", "Exports", "Settings"]));
  });
});
```

Run: `npx vitest run src/lib/nav-config.test.ts` — Expected: FAIL (`getNavGroups` not exported).

- [ ] **Step 2: Implement in `nav-config.ts`**

Add `requiresEmailIntake?: boolean` to `NavItem`, set `requiresEmailIntake: true` on the Automation item, and add:

```ts
/** Nav groups for the current instance; drops items whose feature isn't configured. */
export function getNavGroups({ isEmailIntakeEnabled }: { isEmailIntakeEnabled: boolean }): NavGroup[] {
  return navGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) => isEmailIntakeEnabled || !item.requiresEmailIntake),
  }));
}
```

Run the test — Expected: PASS. (`navItems`/`findNavItem` keep using the full list so the header still resolves titles.)

- [ ] **Step 3: Wire the sidebar**

`app-sidebar.tsx`: change the component signature to take `{ isEmailIntakeEnabled }: { isEmailIntakeEnabled: boolean }`, replace the `navGroups` import with `getNavGroups`, and render `getNavGroups({ isEmailIntakeEnabled }).map(...)` in place of `navGroups.map(...)`.

`src/app/dashboard/layout.tsx`: add `import { isEmailIntakeConfigured } from "@/lib/email-intake";` and render `<AppSidebar isEmailIntakeEnabled={isEmailIntakeConfigured(process.env)} />`.

- [ ] **Step 4: Gate the pages**

`src/app/dashboard/automation/page.tsx`: add `import { notFound } from "next/navigation";` and `import { isEmailIntakeConfigured } from "@/lib/email-intake";`, then make the first line of the component `if (!isEmailIntakeConfigured(process.env)) notFound();`.

`src/app/dashboard/settings/page.tsx`: add the same `isEmailIntakeConfigured` import; compute `const isEmailIntakeEnabled = isEmailIntakeConfigured(process.env);` and wrap the whole "Forwarding address" `<Card>…</Card>` in `{isEmailIntakeEnabled ? ( … ) : null}`. Also skip the `inboxes` query when disabled (`isEmailIntakeEnabled ? await supabase.from("inboxes")... : { data: null }`) — or simply leave the query; it is harmless.

- [ ] **Step 5: Verify**

Run: `npm run test && npx tsc --noEmit && npm run lint && npm run build`.

Manual smoke (in-app browser, `.claude/rules/testing.md`): with the three keys **removed** from `.env.local` — app boots; sidebar has no Automation; `/dashboard/automation` returns 404; Settings has no forwarding card; upload a PDF and confirm extraction works. Then **restore** the keys — Automation reappears and the forwarding card shows.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: hide Automation nav, page and forwarding card when email intake is not configured

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Buyer-facing `docs/SETUP.md` and env example

**Files:**
- Create: `docs/SETUP.md`
- Modify: `.env.local.example`, `docs/deploy.md`, `README.md` (add one link line)

- [ ] **Step 1: `.env.local.example`**

Reword the AgentMail and Trigger.dev headers to mark them optional, e.g.:

```
# --- Optional: email forwarding (set ALL THREE or none) ---
# AgentMail: https://agentmail.to — inbox per user; Trigger.dev: https://cloud.trigger.dev
AGENTMAIL_API_KEY=
AGENTMAIL_WEBHOOK_SECRET=
TRIGGER_SECRET_KEY=
# Project ref also lives in trigger.config.ts; keep them in sync.
TRIGGER_PROJECT_REF=
```

- [ ] **Step 2: Write `docs/SETUP.md`**

Content (exact):

````markdown
# Setup

## Minimum — run the app in ~10 minutes
You need: Node 22, a free Supabase project, one LLM key.

1. `npm install`
2. `cp .env.local.example .env.local`, then set:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (Supabase → Project Settings → API)
   - `EXTRACTION_PROVIDER` (`anthropic` | `google` | `deepseek`) and the matching `*_API_KEY`
3. Apply the database schema: `npx supabase link --project-ref <ref>` then `npx supabase db push`.
4. Supabase → Authentication → URL Configuration: Site URL `http://localhost:3000`.
5. `npm run dev` → open http://localhost:3000, sign up, upload a PDF or image.

Everything works at this point except forwarding by email.

## Recommended before going public — rate limiting
Without it, any signed-in user can trigger unlimited LLM calls on your key.
Create a free Upstash Redis database and set `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`.

## Optional — email forwarding
Adds a per-user forwarding address; forwarded emails are parsed automatically.
Set **all three** or none (the app refuses to start with a partial setup):
- `AGENTMAIL_API_KEY`, `AGENTMAIL_WEBHOOK_SECRET` — agentmail.to; webhook URL `https://<your-domain>/api/webhooks/agentmail`, event `message.received`.
  Cost note: one inbox per user. Free = 3 inboxes, $20/mo = 10, $200/mo = 150.
- `TRIGGER_SECRET_KEY` — cloud.trigger.dev. Edit `project` in `trigger.config.ts` to your own project ref, then `npx trigger.dev@latest deploy` (locally, run `npx trigger.dev@latest dev` next to `npm run dev`).

## Production
See `docs/deploy.md` (Vercel). Supabase free tier pauses after 7 days idle — see `docs/third-party-services.md` (`/api/health` keep-alive).
````

- [ ] **Step 3: Link it**

Add to the top of `README.md`: `> New here? Start with [docs/SETUP.md](docs/SETUP.md).` In `docs/deploy.md` mark `AGENTMAIL_*` and `TRIGGER_*` as optional (moved from the "Required variables" list to "Optional") and delete the `### 5. Trigger.dev — deploy background tasks` step's "required" wording (keep the command, prefixed "If you use email forwarding:").

- [ ] **Step 4: Verify with a cold start**

In a clean clone (or `git worktree`), follow `docs/SETUP.md` steps 1–5 literally with only Supabase + LLM keys. Expected: app boots, sign-up and upload work, no Automation in the nav. Fix the doc where a step is wrong or missing.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: add SETUP.md; mark email forwarding as optional

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-Review

- **Spec coverage:** boot with only Supabase+LLM (Task 2), no AgentMail crash at import (Task 3), no Trigger.dev needed for upload (architecture note, verified by grep), UI hidden when off (Task 4), buyer docs (Task 5), partial config rejected (Task 2).
- **Placeholder scan:** none; Task 4 Step 4 gives the exact guard code; Task 3 Step 1 ends with a grep check for stray importers of the removed `agentmail` export.
- **Type consistency:** `isEmailIntakeConfigured(env: EmailIntakeEnv)` is passed `process.env` everywhere (its values are `string | undefined`, assignable to the `Partial<Record<…>>`); `missingEmailIntakeKeys` signature matches in Tasks 1 and 2; `getNavGroups({ isEmailIntakeEnabled })` matches the sidebar prop name in Task 4.
- **Known unknown:** whether `trigger.config.ts` can read its project ref from an env var was not verified in `node_modules`; SETUP.md therefore tells the buyer to edit the file directly rather than relying on `TRIGGER_PROJECT_REF`.
