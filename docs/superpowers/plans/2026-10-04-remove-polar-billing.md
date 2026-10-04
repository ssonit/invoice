# Remove Polar Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip all Polar billing, plan gating (Starter/Team) and monthly quota out of the codebase so the source can be sold as a self-hosted product with every feature unlocked.

**Architecture:** Delete the billing layer outright rather than leaving `BILLING_MODE=none` as a switch. Every gated feature (exports, forwarding inbox, extraction) becomes unconditionally available. The upload rate limit (Upstash, 10/min/user) stays — it is the only remaining abuse guard on LLM spend. The `billing_subscriptions` table and its migrations stay untouched (additive-only rule, `.claude/rules/data-safety.md`); a buyer who wants billing later can reuse it.

**Tech Stack:** Next.js 16 (App Router, Server Actions), Supabase, Vitest, TypeScript.

**Spec:** Decision made in conversation 2026-10-04 (sell whole source, no marketing/billing). Related: `docs/billing-mode.md`, `docs/billing-polar.md` (both deleted by this plan).

## Global Constraints

- **No physical data deletion.** Do NOT add a migration that drops `billing_subscriptions` or any column (`.claude/rules/data-safety.md`).
- **Keep** `svix` (still used by `src/app/api/webhooks/agentmail/route.ts`), `@upstash/*`, and `src/lib/rate-limit.ts`.
- **Quality gate before every commit that touches `src/lib/`:** `npm run test` and `npx tsc --noEmit` (`.claude/rules/testing.md`).
- Next.js here has breaking changes (`AGENTS.md`) — this plan only deletes code, but if an edit needs a Next API you are unsure of, read `node_modules/next/dist/docs/` first.
- Work in a worktree per `CLAUDE.md`: `git worktree add -b chore/remove-polar .claude/worktrees/remove-polar`.
- Commit messages end with: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`

---

### Task 1: Remove the monthly quota from every extraction path

The quota (`checkStarterQuota`) is called from three places: the upload API route, `processExtraction` (email path), and the upload button (client pre-check via `/api/invoices/quota`). Remove all of them together.

**Files:**
- Modify: `src/lib/invoices/process-extraction.ts`
- Modify: `src/lib/invoices/process-extraction.test.ts`
- Modify: `src/trigger/process-inbound-email.ts`
- Modify: `src/lib/email-reply-templates.ts`
- Modify: `src/lib/email-reply-templates.test.ts`
- Modify: `src/app/api/invoices/upload/route.ts`
- Modify: `src/app/dashboard/upload-invoice-button.tsx`
- Delete: `src/app/api/invoices/quota/route.ts`
- Delete: `src/lib/invoices/upload-batch.ts`, `src/lib/invoices/upload-batch.test.ts`

**Interfaces:**
- Produces: `ProcessExtractionResult = { saved: true; invoice: SavedInvoiceSummary } | { saved: false }` (no `quota` field). `EmailReplyOutcome` loses the `"quota_exceeded"` member.

- [ ] **Step 1: Update the tests first (they must fail against current code)**

In `src/lib/invoices/process-extraction.test.ts`:
1. Delete the line `vi.mock("@/lib/billing/usage", () => ({ checkStarterQuota: vi.fn() }));`
2. Delete `import { checkStarterQuota } from "@/lib/billing/usage";` and `const mockedCheckQuota = vi.mocked(checkStarterQuota);`
3. Delete every remaining use of `mockedCheckQuota` and the `billing_subscriptions` / invoice-count mock chain (`billingMaybeSingle`, `billingSelectEq`, `billingSelect`, the `if (table === "billing_subscriptions")` branch, and its return-object entries).
4. Delete the whole test `it("returns saved:false with quota details when the Starter limit is reached", ...)`.

Run `grep -n "quota\|Quota\|billing" src/lib/invoices/process-extraction.test.ts` — must print nothing.

In `src/lib/email-reply-templates.test.ts`: delete the test case that uses `type: "quota_exceeded"` (around line 51). Run `grep -n quota src/lib/email-reply-templates.test.ts` — must print nothing.

- [ ] **Step 2: Run tests, confirm they fail**

Run: `npx vitest run src/lib/invoices/process-extraction.test.ts`
Expected: FAIL — code still imports and calls the real `checkStarterQuota`, which hits an un-mocked Supabase chain.

- [ ] **Step 3: Remove quota from `process-extraction.ts`**

Delete the import `import { checkStarterQuota } from "@/lib/billing/usage";`.

Change the result type:

```ts
export type ProcessExtractionResult =
  | { saved: true; invoice: SavedInvoiceSummary }
  | { saved: false };
```

Delete this whole block (between the dedup branch and `const { extraction: extracted, metrics } = await extractInvoice(input);`):

```ts
  // Starter-plan monthly quota — skip the LLM call when the user has
  // reached their cap this month. ...
  const quota = await checkStarterQuota(supabase, userId);
  if (!quota.allowed) {
    ...
    return { saved: false, quota: { used: quota.used, limit: quota.limit, resetsAt: quota.resetsAt } };
  }
```

- [ ] **Step 4: Remove quota from `src/trigger/process-inbound-email.ts`**

Delete `let quotaExceeded: { used: number; limit: number; resetsAt: string } | null = null;`.

Replace the body-extraction result handling with:

```ts
        if (result.saved) {
          saved.push(result.invoice);
        }
```

In `batch.runs.forEach`, delete the `else if (!run.output.saved && run.output.quota) { quotaExceeded = run.output.quota; }` branch (keep the `if (!run.ok) { ... }` branch).

Replace the outcome expression with:

```ts
    const outcome: EmailReplyOutcome =
      saved.length > 0
        ? { type: "processed", invoices: saved }
        : anyAttachmentFailed
          ? { type: "error" }
          : { type: "skipped" };
```

- [ ] **Step 5: Remove `quota_exceeded` from `src/lib/email-reply-templates.ts`**

Delete the union member `| { type: "quota_exceeded"; used: number; limit: number; resetsAt: string }` and the entire `case "quota_exceeded": { ... }` block.

- [ ] **Step 6: Remove quota from the upload route**

In `src/app/api/invoices/upload/route.ts` delete `import { checkStarterQuota } from "@/lib/billing/usage";` and the block starting at `// Starter-plan monthly quota — skip the LLM call...` through the closing `}` of `if (!quota.allowed) { ... status: 429 ... }`. The code then flows straight from the duplicate check to `const input = mimeType === "application/pdf" ...`.

- [ ] **Step 7: Remove the client pre-check**

In `src/app/dashboard/upload-invoice-button.tsx`:
- Delete the imports `splitFilesByQuota` and `type QuotaStatus`.
- Delete the whole `async function fetchQuotaStatus(): Promise<QuotaStatus> { ... }`.
- In `confirmUpload`, delete the two lines `const quota = await fetchQuotaStatus();` and `const { toUpload, skipped } = splitFilesByQuota(files, quota);`, and change `runWithConcurrencyLimit(toUpload, ...)` to `runWithConcurrencyLimit(files, ...)`.
- Delete the `for (const file of skipped) { recordOutcome({ ... "Skipped — monthly invoice limit reached" ... }); }` loop.

- [ ] **Step 8: Delete dead files**

```bash
git rm -r src/app/api/invoices/quota
git rm src/lib/invoices/upload-batch.ts src/lib/invoices/upload-batch.test.ts
```

- [ ] **Step 9: Verify**

Run: `npm run test && npx tsc --noEmit`
Expected: all pass, no type errors. `grep -rn "checkStarterQuota\|splitFilesByQuota\|quota_exceeded" src` prints nothing.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "refactor: remove monthly invoice quota from upload and email paths

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Remove Team gating from exports, forwarding inbox, settings

**Files:**
- Modify: `src/app/api/exports/invoices/route.ts`
- Modify: `src/app/dashboard/exports/page.tsx`
- Modify: `src/app/dashboard/automation/page.tsx`
- Modify: `src/components/dashboard/automation/automation-view.tsx`
- Modify: `src/components/dashboard/automation/connection-panel.tsx`
- Modify: `src/app/dashboard/settings/page.tsx`
- Modify: `src/app/dashboard/actions.ts`
- Delete: `src/components/dashboard/inbox-provision-panel.tsx`, `src/components/dashboard/team-gate.tsx`, `src/app/dashboard/settings/billing-card.tsx`
- Delete: `src/lib/billing.ts`, `src/lib/billing.test.ts`, `src/lib/billing/` (access.ts, usage.ts, usage.test.ts), `src/constants/billing.ts`

**Interfaces:**
- Consumes: `CreateInboxButton` from `@/components/dashboard/create-inbox-button` (already exists, no props).
- Produces: `AutomationView` props become `{ forwardAddress: string | null; receivedCount: number; agents: readonly AutomationAgent[] }`. `ConnectionPanel` props become `{ forwardAddress: string | null; receivedCount: number }`.

- [ ] **Step 1: Exports route and page**

`src/app/api/exports/invoices/route.ts`: delete `import { getTeamAccess } from "@/lib/billing/access";` and the block:

```ts
  const access = await getTeamAccess();
  if (!access.allowed) {
    return NextResponse.json(
      { error: "Team plan required for CSV exports." },
      { status: 403 },
    );
  }
```

`src/app/dashboard/exports/page.tsx`: delete the imports of `getTeamAccess` and `TeamGate`, and the block `const access = await getTeamAccess(); if (!access.allowed) { return (<TeamGate .../>); }`.

- [ ] **Step 2: Automation page + view + panel**

`src/app/dashboard/automation/page.tsx` — replace the whole file body with:

```tsx
import { createClient } from "@/lib/supabase/server";
import { AutomationView } from "@/components/dashboard/automation/automation-view";
import { AUTOMATION_AGENTS } from "@/lib/automation/agents";
import { INBOX_SOURCE_FILTER } from "@/constants/inbox";

export default async function AutomationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: inbox }, { count, error: countError }] = await Promise.all([
    supabase
      .from("inboxes")
      .select("email_address")
      .eq("user_id", user!.id)
      .maybeSingle(),
    supabase
      .from("invoices")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user!.id)
      .eq("source", INBOX_SOURCE_FILTER.EMAIL),
  ]);

  // A failed count must not break the page — the address and prompts are
  // still useful, so fall back to the "waiting" state.
  if (countError) {
    console.error("Failed to load automation status", user!.id, countError);
  }

  return (
    <AutomationView
      forwardAddress={inbox?.email_address ?? null}
      receivedCount={count ?? 0}
      agents={AUTOMATION_AGENTS}
    />
  );
}
```

`automation-view.tsx`: remove the `canProvision` prop (destructure + type), stop passing it to `ConnectionPanel`, and replace the `{canProvision ? "Create your forwarding address above ..." : "Upgrade to Team above ..."}` ternary with the plain string `Create your forwarding address above to get the agent setup prompts.`

`connection-panel.tsx`: remove `canProvision` from props/type; replace `<InboxProvisionPanel canProvision={canProvision} />` with `<CreateInboxButton />` and swap the import `InboxProvisionPanel` → `import { CreateInboxButton } from "@/components/dashboard/create-inbox-button";`. In the `CardDescription` delete the sentence ` Available on the Team plan.` (the text ends at `...is touched.`).

- [ ] **Step 3: Settings page**

In `src/app/dashboard/settings/page.tsx`:
- Remove imports: `InboxProvisionPanel`, `BillingCard`, all of `@/lib/billing` and `@/lib/billing/usage`.
- Add `import { CreateInboxButton } from "@/components/dashboard/create-inbox-button";`.
- Remove the `searchParams` prop and `justCheckedOut`; the function signature becomes `export default async function SettingsPage()`.
- Replace the `Promise.all([...])` with a single query: `const { data: inbox } = await supabase.from("inboxes").select("email_address").eq("user_id", user!.id).maybeSingle();` and delete the `subscriptionError` logging, the `usage` computation, `isTeam`, and `mayProvisionInbox`.
- Change `description="Manage forwarding, billing, and account security."` to `description="Manage forwarding and account security."`.
- Delete ` Available on the Team plan.` from the forwarding `CardDescription`.
- Replace `<InboxProvisionPanel canProvision={mayProvisionInbox} />` with `<CreateInboxButton />`.
- Delete the entire "Billing" `<Card>...</Card>`.

- [ ] **Step 4: Server actions**

In `src/app/dashboard/actions.ts`:
- Delete imports: `headers` from `next/headers`, `createPolarCheckout, createPolarCustomerPortal`, and `canProvisionInbox, getBillingMode`.
- In `createInbox`, delete the `billingRow` query and the `if (!canProvisionInbox(billingRow)) { return ... }` block, and update the header comment to drop "New provisioning requires Team (...); existing inboxes are grandfathered ...".
- Delete `CreateCheckoutUrlResult`, `createCheckoutUrl`, `OpenCustomerPortalResult`, `openCustomerPortal` (everything from `export type CreateCheckoutUrlResult` to end of file).

- [ ] **Step 5: Delete dead files**

```bash
git rm src/components/dashboard/inbox-provision-panel.tsx src/components/dashboard/team-gate.tsx
git rm src/app/dashboard/settings/billing-card.tsx
git rm src/lib/billing.ts src/lib/billing.test.ts
git rm -r src/lib/billing
git rm src/constants/billing.ts
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit`
Expected: errors only about `@/lib/polar` / `polar-webhook` / `env.ts` / the Polar webhook route importing deleted billing symbols (fixed in Task 3). If anything else errors, fix it now. Run `npm run lint` — expected clean for touched files.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: remove Team plan gating (exports, inbox, settings billing card)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Delete Polar integration, env schema, dependency

**Files:**
- Delete: `src/lib/polar.ts`, `src/lib/polar-webhook.ts`, `src/lib/polar-webhook.test.ts`, `src/app/api/webhooks/polar/`
- Modify: `src/lib/validation/env.ts`, `src/lib/validation/env.test.ts`
- Modify: `src/lib/validation/webhooks.ts`, `src/lib/validation/webhooks.test.ts` (only if they reference Polar)
- Modify: `src/constants/validation.ts` (comment), `package.json`, `package-lock.json`, `.env.local.example`, `.github/workflows/ci.yml`

**Interfaces:**
- Produces: `envSchema` without any `BILLING_*`, `POLAR_*`, `STARTER_*` keys.

- [ ] **Step 1: Update `env.test.ts` first**

In `src/lib/validation/env.test.ts` remove `BILLING_MODE: "none"` from `validBase` and delete every test whose title or body mentions `BILLING_MODE`, `POLAR_`, or billing. Add this test inside the `describe("parseEnvInput")` block so removed variables are provably ignored:

```ts
  it("ignores legacy billing variables instead of rejecting them", () => {
    const result = parseEnvInput({
      ...validBase,
      ANTHROPIC_API_KEY: "sk-ant-x",
      BILLING_MODE: "live",
      POLAR_ACCESS_TOKEN: "",
    });
    expect(result.success).toBe(true);
  });
```

Run: `npx vitest run src/lib/validation/env.test.ts`
Expected: the new test FAILS (schema still requires `POLAR_*` when `BILLING_MODE=live`).

- [ ] **Step 2: Remove billing from `env.ts`**

Delete: `const BILLING_ENABLED_MODES = ...`, the keys `BILLING_DEV_UNLOCK`, `BILLING_MODE`, `POLAR_ACCESS_TOKEN`, `POLAR_ORGANIZATION_ID`, `POLAR_TEAM_PRODUCT_ID`, `POLAR_WEBHOOK_SECRET`, `STARTER_MONTHLY_INVOICE_LIMIT` with their comments, and the whole second `.superRefine((env, ctx) => { const billingMode = ... })` block. Zod objects strip unknown keys by default, so legacy vars in `.env` stay harmless.

- [ ] **Step 3: Run env tests**

Run: `npx vitest run src/lib/validation/env.test.ts`
Expected: PASS.

- [ ] **Step 4: Delete Polar code and dependency**

```bash
git rm src/lib/polar.ts src/lib/polar-webhook.ts src/lib/polar-webhook.test.ts
git rm -r src/app/api/webhooks/polar
npm uninstall @polar-sh/sdk
```

Run `grep -rniE "polar" src .github package.json` and fix each hit: comments in `src/lib/validation/webhooks.ts` and `src/constants/validation.ts` (`/** Webhook JSON bodies (Polar, AgentMail). */` → `/** Webhook JSON bodies (AgentMail). */`), any Polar test in `webhooks.test.ts`, and `BILLING_MODE` / `POLAR_*` dummy env in `.github/workflows/ci.yml`. Final grep must print nothing.

- [ ] **Step 5: Clean `.env.local.example`**

Delete the sections headed `# Polar (billing ...)`, `# Billing mode: ...`, `# DEV ONLY — unlocks Team features ...` and `# Starter-plan monthly invoice extraction cap ...` including their variables.

- [ ] **Step 6: Full gate**

Run: `npm run test && npm run lint && npx tsc --noEmit && npm run build`
Expected: all green. (`npm run build` needs real or dummy env — use the same dummy values CI uses.)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: remove Polar SDK, webhook route, and billing env vars

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Landing, legal copy, docs

**Files:**
- Modify: `src/components/landing/landing-page.tsx`, `src/components/landing/nav.tsx`, `src/components/landing/footer.tsx`
- Delete: `src/components/landing/pricing.tsx`
- Modify: `src/lib/landing/dictionary.ts`, `src/lib/legal/dictionary.ts`
- Delete: `docs/billing-polar.md`, `docs/billing-mode.md`
- Modify: `docs/third-party-services.md`, `docs/deploy.md`, `docs/DEVELOPMENT.md` (only if it mentions billing)

- [ ] **Step 1: Landing page**

- `landing-page.tsx`: delete `import { LandingPricing } ...` and `<LandingPricing />`.
- `nav.tsx` (line ~60): delete the `{ id: "pricing", label: t.nav.pricing },` entry.
- `footer.tsx` (line ~67): delete the pricing link element (the `onClick={() => scrollToId("pricing")}` item and its label `t.footer.links.pricing`).
- `git rm src/components/landing/pricing.tsx`.
- In `src/lib/landing/dictionary.ts` delete the `pricing` block (both `en` and `vi` locales) plus `nav.pricing` and `footer.links.pricing`. Run `npx tsc --noEmit` and remove any other key the compiler reports as now-orphaned in the dictionary type.

- [ ] **Step 2: Legal copy**

In `src/lib/legal/dictionary.ts` the "4. Payments & billing" section body mentions Polar. Keep the heading (numbering stays valid) and replace the body:
- English: `This service does not process payments.`
- Vietnamese: `Dịch vụ này không xử lý thanh toán.`

Run `grep -n "Polar" src/lib/legal/dictionary.ts` — must print nothing (also check any "Starter"/"Team plan" mention in the Terms text).

- [ ] **Step 3: Docs**

```bash
git rm docs/billing-polar.md docs/billing-mode.md
```

- `docs/third-party-services.md`: delete the whole `## Polar (billing)` section.
- `docs/deploy.md`: remove `POLAR_*` from the required variable list, delete the "Never set `BILLING_DEV_UNLOCK`" paragraph, delete "### 6. Polar — webhook", and drop smoke-checklist lines about billing card / Team plan (replace with `- [ ] **Exports:** CSV export downloads.`).
- Update the memory index: `C:\Users\LEGION\.claude\projects\D--Project-invoice\memory\MEMORY.md` — delete the `[Billing mode](...)` line.

- [ ] **Step 4: Final verification**

Run: `npm run test && npm run lint && npx tsc --noEmit && npm run build`
Then: `grep -rniE "polar|billing_mode|checkStarterQuota|hasActiveTeamPlan|TeamGate" src docs README.md .github package.json .env.local.example` — expected hits only inside `docs/superpowers/` (historical specs/plans) and the old SQL migration files.

Manual smoke (in-app browser per `.claude/rules/testing.md`): `npm run dev`, then confirm — Settings page loads with no Billing card; Exports page shows the export panel (no upgrade gate); uploading a PDF extracts without any quota message; Automation page shows a "create forwarding address" button instead of an upgrade CTA.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: drop pricing section, Polar legal copy, and billing docs

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-Review

- **Spec coverage:** Polar SDK/webhook/checkout (Task 3, 2), Team gating on exports/inbox/automation/settings (Task 2), quota in upload/email/client (Task 1), env + CI (Task 3), landing/legal/docs (Task 4). `billing_subscriptions` intentionally kept.
- **Placeholder scan:** edits that depend on unseen lines (Task 1 Step 1 mock-chain cleanup, Task 3 Step 1 test removal, Task 4 dictionary orphans) are guarded by a concrete `grep`/`tsc` completion check instead of guessing line numbers.
- **Type consistency:** `ProcessExtractionResult` loses `quota` in Task 1 and nothing later in the plan references it; `AutomationView`/`ConnectionPanel` drop `canProvision` together in Task 2.
