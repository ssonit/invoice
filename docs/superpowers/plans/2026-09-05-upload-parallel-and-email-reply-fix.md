# Parallel Upload + Email Reply-Fidelity Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Make the manual multi-file invoice upload run in parallel instead of
sequentially, without letting concurrent requests blow past the Starter monthly quota;
(2) fix `process-inbound-email`'s Trigger.dev task so a sender never gets an "error"
auto-reply when some of their attachments actually did get saved.

**Architecture:** Both fixes are bounded changes to two existing, unrelated flows —
no new subsystem, no schema migration. Part A adds a client-side quota pre-check
(`GET /api/invoices/quota`) plus a small bounded-concurrency runner so the upload
button fires at most `UPLOAD_CONCURRENCY_LIMIT` requests at once and never sends more
files than the user has remaining quota for. Part B adds a per-attachment
`idempotencyKey` so a parent-task retry reuses child runs instead of duplicating them,
and changes `onFailure` to check what was actually saved before deciding the reply.

**Tech Stack:** Next.js route handlers, Supabase (service client), Trigger.dev v3 SDK,
Vitest.

**Spec:** None — this is a Bounded change (existing flows, no new subsystem). Design was
presented and approved in chat; this plan is the implementation breakdown of that
approved design.

## Global Constraints

- Pure logic goes in `src/lib/`; orchestration (routes, trigger tasks, components) stays
  thin and calls into it — `.claude/rules/code-style.md`.
- No magic numbers inline — new constants go in `src/constants/` —
  `.claude/rules/constants.md`.
- API routes, Trigger.dev tasks (`src/trigger/*.ts`), and UI components are **not**
  unit-tested by convention here — verified manually against the dev server instead —
  `.claude/rules/testing.md`. Every new/changed `src/lib/` function gets a `.test.ts`.
- Before any commit touching `src/lib/`: `npm run test` and `npx tsc --noEmit` —
  `.claude/rules/testing.md`.
- Supabase client rule: RLS client (`createClient()`) for the auth check, service client
  (`createServiceClient()`) only after that check passes — `.claude/rules/supabase-conventions.md`.
- Never physically delete data; not applicable to this plan (no deletes involved), noted
  per `.claude/rules/data-safety.md` for completeness.

---

## Part A — Parallel manual upload with a quota-safe batch

### Task 1: `getQuotaStatus()` in the billing usage lib

**Files:**
- Modify: `src/lib/billing/usage.ts` (add `QuotaStatus` type + `getQuotaStatus()`, refactor `checkStarterQuota()` to call it — full current file is 105 lines, see below for exact placement)
- Modify: `src/lib/billing/usage.test.ts` (add a `describe("getQuotaStatus")` block)

**Interfaces:**
- Produces: `QuotaStatus = { unlimited: true } | { unlimited: false; used: number; limit: number }`, `getQuotaStatus(supabase: ServiceClient, userId: string): Promise<QuotaStatus>` — consumed by Task 2 (route) and, via `import type`, Task 4 (`splitFilesByQuota`).
- `checkStarterQuota`'s existing signature and return type (`QuotaCheckResult`) are unchanged — every existing caller (`process-extraction.ts`, `upload/route.ts`) and every existing test in `usage.test.ts` keeps passing untouched.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/billing/usage.test.ts`, after the existing `checkStarterQuota` describe
block (the file already imports `checkStarterQuota`, `countBillableInvoicesThisMonth`,
`getMonthRangeUtc`, `getStarterMonthlyLimit` from `./usage` — add `getQuotaStatus` to
that import list):

```ts
// ---------------------------------------------------------------------------
// getQuotaStatus
// ---------------------------------------------------------------------------

describe("getQuotaStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("returns unlimited when billing mode is none", async () => {
    vi.stubEnv("BILLING_MODE", "none");
    const supabase = mockSupabaseClient({});
    const result = await getQuotaStatus(supabase, "user-1");
    expect(result).toEqual({ unlimited: true });
  });

  it("returns unlimited when dev unlock is enabled", async () => {
    vi.stubEnv("BILLING_DEV_UNLOCK", "true");
    vi.stubEnv("NODE_ENV", "development");
    const supabase = mockSupabaseClient({});
    const result = await getQuotaStatus(supabase, "user-1");
    expect(result).toEqual({ unlimited: true });
  });

  it("returns unlimited for an active Team plan", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const supabase = mockSupabaseClient({
      billingRow: { plan: "team", status: "active", ends_at: null } as BillingSubscriptionRow,
    });
    const result = await getQuotaStatus(supabase, "user-1");
    expect(result).toEqual({ unlimited: true });
  });

  it("returns used/limit for a Starter user under the cap", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STARTER_MONTHLY_INVOICE_LIMIT", "10");
    const supabase = mockSupabaseClient({ billingRow: null, invoiceCount: 4 });
    const result = await getQuotaStatus(supabase, "user-1");
    expect(result).toEqual({ unlimited: false, used: 4, limit: 10 });
  });

  it("returns used/limit for a Starter user already over the cap", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STARTER_MONTHLY_INVOICE_LIMIT", "10");
    const supabase = mockSupabaseClient({ billingRow: null, invoiceCount: 15 });
    const result = await getQuotaStatus(supabase, "user-1");
    expect(result).toEqual({ unlimited: false, used: 15, limit: 10 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- src/lib/billing/usage.test.ts`
Expected: FAIL — `getQuotaStatus is not exported from "./usage"` (or similar import error).

- [ ] **Step 3: Implement `getQuotaStatus` and refactor `checkStarterQuota`**

In `src/lib/billing/usage.ts`, add the new type next to `QuotaCheckResult` (after line 9):

```ts
export type QuotaStatus =
  | { unlimited: true }
  | { unlimited: false; used: number; limit: number };
```

Replace the existing `checkStarterQuota` function (current lines 76-104) with:

```ts
/**
 * Current Starter-quota usage snapshot for a user, without deciding
 * allow/deny. Shared by checkStarterQuota (the extraction gate) and the
 * /api/invoices/quota route, which lets the upload UI cap a batch to the
 * remaining slots before sending any requests — closing the race where N
 * parallel uploads each see "quota not reached" before any of their writes
 * land.
 */
export async function getQuotaStatus(
  supabase: ServiceClient,
  userId: string,
): Promise<QuotaStatus> {
  // 1. Billing disabled → unlimited.
  if (getBillingMode() === "none") return { unlimited: true };

  // 2. Dev unlock → unlimited.
  if (isBillingDevUnlockEnabled()) return { unlimited: true };

  // 3. Active Team plan → unlimited.
  const { data: billingRow } = await supabase
    .from("billing_subscriptions")
    .select("plan, status, ends_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (hasActiveTeamPlan(billingRow)) return { unlimited: true };

  // 4. Starter — count invoices created this UTC month.
  const used = await countBillableInvoicesThisMonth(supabase, userId);
  const limit = getStarterMonthlyLimit();
  return { unlimited: false, used, limit };
}

/**
 * Check whether a user can extract another invoice under the Starter quota.
 * Called from the upload API route and the email extraction path.
 */
export async function checkStarterQuota(
  supabase: ServiceClient,
  userId: string,
): Promise<QuotaCheckResult> {
  const status = await getQuotaStatus(supabase, userId);
  if (status.unlimited) return { allowed: true };
  if (status.used < status.limit) return { allowed: true };

  const { end } = getMonthRangeUtc();
  return { allowed: false, used: status.used, limit: status.limit, resetsAt: end.toISOString() };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- src/lib/billing/usage.test.ts`
Expected: PASS — all existing `checkStarterQuota` tests still pass unchanged, plus the
new `getQuotaStatus` tests.

- [ ] **Step 5: Type-check and commit**

Run: `npx tsc --noEmit`

```bash
git add src/lib/billing/usage.ts src/lib/billing/usage.test.ts
git commit -m "$(cat <<'EOF'
refactor: extract getQuotaStatus from checkStarterQuota

Reusable quota snapshot (unlimited | used/limit) needed by the new
/api/invoices/quota route, without changing checkStarterQuota's existing
allow/deny behavior or callers.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `GET /api/invoices/quota` route

**Files:**
- Create: `src/app/api/invoices/quota/route.ts`

**Interfaces:**
- Consumes: `getQuotaStatus(supabase, userId)` from Task 1.
- Produces: `GET /api/invoices/quota` → `200` with a JSON body shaped like `QuotaStatus`
  (`{ unlimited: true }` or `{ unlimited: false, used, limit }`), or `401` if not
  authenticated. Consumed by Task 5 (upload button).

Not unit-tested (API routes are excluded per `.claude/rules/testing.md`) — verified
manually in Task 5's browser smoke test.

- [ ] **Step 1: Implement the route**

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getQuotaStatus } from "@/lib/billing/usage";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const status = await getQuotaStatus(createServiceClient(), user.id);
  return NextResponse.json(status);
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/invoices/quota/route.ts
git commit -m "$(cat <<'EOF'
feat: add GET /api/invoices/quota endpoint

Lets the upload UI read remaining Starter-quota slots before sending a
multi-file batch, so it can cap the batch instead of racing the per-request
quota check.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Bounded-concurrency runner

**Files:**
- Create: `src/lib/concurrency/run-with-limit.ts`
- Test: `src/lib/concurrency/run-with-limit.test.ts`

**Interfaces:**
- Produces: `runWithConcurrencyLimit<T, R>(items: readonly T[], limit: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]>` — consumed by Task 5.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { runWithConcurrencyLimit } from "./run-with-limit";

describe("runWithConcurrencyLimit", () => {
  it("returns results in input order regardless of completion order", async () => {
    const worker = async (item: number) => {
      await new Promise((r) => setTimeout(r, item === 1 ? 20 : 5));
      return item * 10;
    };
    const results = await runWithConcurrencyLimit([1, 2, 3], 3, worker);
    expect(results).toEqual([10, 20, 30]);
  });

  it("never runs more than `limit` workers concurrently", async () => {
    let active = 0;
    let maxActive = 0;
    const worker = async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 10));
      active--;
    };
    await runWithConcurrencyLimit([1, 2, 3, 4, 5], 2, worker);
    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it("passes the index of each item to the worker", async () => {
    const seen: number[] = [];
    await runWithConcurrencyLimit(["a", "b", "c"], 1, async (_item, index) => {
      seen.push(index);
    });
    expect(seen).toEqual([0, 1, 2]);
  });

  it("returns an empty array for an empty input without calling the worker", async () => {
    const worker = vi.fn();
    const results = await runWithConcurrencyLimit([], 3, worker);
    expect(results).toEqual([]);
    expect(worker).not.toHaveBeenCalled();
  });

  it("still runs everything when limit exceeds the item count", async () => {
    const results = await runWithConcurrencyLimit([1, 2], 10, async (item) => item);
    expect(results).toEqual([1, 2]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- src/lib/concurrency/run-with-limit.test.ts`
Expected: FAIL — cannot find module `./run-with-limit`.

- [ ] **Step 3: Implement the runner**

```ts
/**
 * Runs `worker` over `items` with at most `limit` calls in flight at once.
 * Results are returned in the same order as `items`, regardless of
 * completion order — matches how Trigger.dev's `batchTriggerAndWait` reports
 * batch results, so callers can zip results back to their inputs by index.
 */
export async function runWithConcurrencyLimit<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function runLane(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await worker(items[index]!, index);
    }
  }

  const laneCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: laneCount }, () => runLane()));
  return results;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- src/lib/concurrency/run-with-limit.test.ts`
Expected: PASS (all 5 tests).

- [ ] **Step 5: Type-check and commit**

Run: `npx tsc --noEmit`

```bash
git add src/lib/concurrency/run-with-limit.ts src/lib/concurrency/run-with-limit.test.ts
git commit -m "$(cat <<'EOF'
feat: add runWithConcurrencyLimit helper

Generic bounded-concurrency runner for the upload button — no existing
lib/ helper does this (checked before adding).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `splitFilesByQuota`

**Files:**
- Create: `src/lib/invoices/upload-batch.ts`
- Test: `src/lib/invoices/upload-batch.test.ts`

**Interfaces:**
- Consumes: `QuotaStatus` type from `@/lib/billing/usage` (Task 1), via `import type` only
  (erased at compile time — safe to reference from a file a client component imports).
- Produces: `splitFilesByQuota<T>(files: readonly T[], quota: QuotaStatus): { toUpload: T[]; skipped: T[] }` — consumed by Task 5.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { splitFilesByQuota } from "./upload-batch";

describe("splitFilesByQuota", () => {
  it("uploads everything when quota is unlimited", () => {
    const result = splitFilesByQuota(["a", "b", "c"], { unlimited: true });
    expect(result).toEqual({ toUpload: ["a", "b", "c"], skipped: [] });
  });

  it("caps the batch to the remaining slots", () => {
    const result = splitFilesByQuota(["a", "b", "c"], { unlimited: false, used: 8, limit: 10 });
    expect(result).toEqual({ toUpload: ["a", "b"], skipped: ["c"] });
  });

  it("skips everything when already at the limit", () => {
    const result = splitFilesByQuota(["a", "b"], { unlimited: false, used: 10, limit: 10 });
    expect(result).toEqual({ toUpload: [], skipped: ["a", "b"] });
  });

  it("skips everything when already over the limit", () => {
    const result = splitFilesByQuota(["a", "b"], { unlimited: false, used: 15, limit: 10 });
    expect(result).toEqual({ toUpload: [], skipped: ["a", "b"] });
  });

  it("uploads everything when remaining slots exceed the batch size", () => {
    const result = splitFilesByQuota(["a"], { unlimited: false, used: 0, limit: 10 });
    expect(result).toEqual({ toUpload: ["a"], skipped: [] });
  });

  it("handles an empty batch", () => {
    const result = splitFilesByQuota([], { unlimited: false, used: 0, limit: 10 });
    expect(result).toEqual({ toUpload: [], skipped: [] });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- src/lib/invoices/upload-batch.test.ts`
Expected: FAIL — cannot find module `./upload-batch`.

- [ ] **Step 3: Implement `splitFilesByQuota`**

```ts
import type { QuotaStatus } from "@/lib/billing/usage";

export type FileBatchSplit<T> = { toUpload: T[]; skipped: T[] };

/**
 * Caps a batch of files to the user's remaining Starter-quota slots before
 * any of them are sent to the server — closes the race where N parallel
 * upload requests each read "quota not yet reached" before any of their
 * writes land. Files beyond the remaining slots are skipped client-side
 * without spending a request or an LLM call.
 */
export function splitFilesByQuota<T>(
  files: readonly T[],
  quota: QuotaStatus,
): FileBatchSplit<T> {
  if (quota.unlimited) {
    return { toUpload: [...files], skipped: [] };
  }
  const remaining = Math.max(0, quota.limit - quota.used);
  return {
    toUpload: files.slice(0, remaining),
    skipped: files.slice(remaining),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- src/lib/invoices/upload-batch.test.ts`
Expected: PASS (all 6 tests).

- [ ] **Step 5: Type-check and commit**

Run: `npx tsc --noEmit`

```bash
git add src/lib/invoices/upload-batch.ts src/lib/invoices/upload-batch.test.ts
git commit -m "$(cat <<'EOF'
feat: add splitFilesByQuota for batch-level quota capping

Pure function the upload button uses to cap a multi-file batch to
remaining quota slots before sending any requests.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Parallelize `UploadInvoiceButton`

**Files:**
- Create: `src/constants/upload.ts`
- Modify: `src/app/dashboard/upload-invoice-button.tsx`

**Interfaces:**
- Consumes: `runWithConcurrencyLimit` (Task 3), `splitFilesByQuota` + `FileBatchSplit`
  (Task 4), `QuotaStatus` type (Task 1), `GET /api/invoices/quota` (Task 2).

Not unit-tested (UI component, excluded per `.claude/rules/testing.md`) — verified
manually via the dev server (Step 4 below).

- [ ] **Step 1: Add the concurrency constant**

Create `src/constants/upload.ts`:

```ts
/** Max manual invoice uploads processed in parallel from one confirm-upload batch. */
export const UPLOAD_CONCURRENCY_LIMIT = 3;
```

- [ ] **Step 2: Rewrite `confirmUpload` in `upload-invoice-button.tsx`**

Add these imports near the top of the file (after the existing `validateUploadFile` import):

```ts
import { runWithConcurrencyLimit } from "@/lib/concurrency/run-with-limit";
import { splitFilesByQuota } from "@/lib/invoices/upload-batch";
import type { QuotaStatus } from "@/lib/billing/usage";
import { UPLOAD_CONCURRENCY_LIMIT } from "@/constants/upload";
```

Add this helper above `export function UploadInvoiceButton()`:

```ts
async function fetchQuotaStatus(): Promise<QuotaStatus> {
  try {
    const res = await fetch("/api/invoices/quota");
    if (!res.ok) return { unlimited: true };
    return await res.json();
  } catch {
    // Fail open — don't block the upload UI on a quota-check hiccup; the
    // per-request 429 from /api/invoices/upload still enforces the real limit.
    return { unlimited: true };
  }
}
```

Replace the existing `confirmUpload` function (current lines 124-166) with:

```ts
  async function confirmUpload() {
    if (pending.length === 0 || isUploading) return;

    const files = pending.map((item) => item.file);
    const quota = await fetchQuotaStatus();
    const { toUpload, skipped } = splitFilesByQuota(files, quota);

    setProgress({ current: 0, total: files.length });
    const outcomes: UploadOutcome[] = [];
    let stopped = false;

    function recordOutcome(outcome: UploadOutcome) {
      outcomes.push(outcome);
      setProgress((prev) => (prev ? { current: prev.current + 1, total: prev.total } : prev));
    }

    try {
      await runWithConcurrencyLimit(toUpload, UPLOAD_CONCURRENCY_LIMIT, async (file) => {
        if (stopped) {
          recordOutcome({ ok: false, fileName: file.name, error: "Skipped — rate limited" });
          return;
        }
        try {
          const outcome = await uploadOne(file);
          recordOutcome(outcome);
          if (!outcome.ok && /too many uploads/i.test(outcome.error)) {
            stopped = true;
          }
        } catch {
          recordOutcome({
            ok: false,
            fileName: file.name,
            error: "Upload failed — check your connection and try again",
          });
        }
      });

      for (const file of skipped) {
        recordOutcome({
          ok: false,
          fileName: file.name,
          error: "Skipped — monthly invoice limit reached",
        });
      }

      toastUploadResults(outcomes);
      if (outcomes.some((o) => o.ok)) {
        router.refresh();
      }
      setPending([]);
      setOpen(false);
    } finally {
      setProgress(null);
    }
  }
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual smoke test**

Run: `npm run test` and `npx tsc --noEmit` first (whole-repo gate), then:

1. Start the dev server (`npm run dev`) and open the dashboard in the browser tool.
2. Click "Upload invoice", select 3-5 small PDF/image files at once, confirm.
3. Verify: the dialog shows "Extracting N/total..." counting up, all files resolve
   (toast shows success/fail summary), and the invoices table refreshes with the new
   rows.
4. With `STARTER_MONTHLY_INVOICE_LIMIT` set low in `.env.local` (e.g. `2`) and
   `BILLING_MODE=test`, select more files than the remaining quota allows; verify the
   excess files are skipped with "monthly invoice limit reached" in the toast and were
   never sent (check Network tab — no `/api/invoices/upload` request for them).
5. Confirm no console errors (`read_console_messages`).

- [ ] **Step 5: Commit**

```bash
git add src/constants/upload.ts src/app/dashboard/upload-invoice-button.tsx
git commit -m "$(cat <<'EOF'
feat: parallelize manual invoice upload with quota-safe batching

Uploads up to UPLOAD_CONCURRENCY_LIMIT files concurrently instead of one
at a time, and pre-caps the batch to remaining quota slots (via the new
/api/invoices/quota + splitFilesByQuota) to close the race where parallel
requests could each pass the per-request quota check.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Part B — Email reply-fidelity fix

### Task 6: `buildFailureOutcome`

**Files:**
- Create: `src/lib/invoices/build-failure-outcome.ts`
- Test: `src/lib/invoices/build-failure-outcome.test.ts`

**Interfaces:**
- Consumes: `SavedInvoiceSummary` from `./process-extraction`, `EmailReplyOutcome` from
  `../email-reply-templates` (both already exist, unchanged).
- Produces: `buildFailureOutcome(saved: SavedInvoiceSummary[]): EmailReplyOutcome` —
  consumed by Task 7.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { buildFailureOutcome } from "./build-failure-outcome";

describe("buildFailureOutcome", () => {
  it("returns a processed outcome when at least one invoice was saved", () => {
    const saved = [{ vendor: "Acme", amount: 10, currency: "USD" }];
    expect(buildFailureOutcome(saved)).toEqual({ type: "processed", invoices: saved });
  });

  it("returns an error outcome when nothing was saved", () => {
    expect(buildFailureOutcome([])).toEqual({ type: "error" });
  });

  it("includes every saved invoice, not just the first", () => {
    const saved = [
      { vendor: "Acme", amount: 10, currency: "USD" },
      { vendor: "Globex", amount: 20, currency: "USD" },
    ];
    expect(buildFailureOutcome(saved)).toEqual({ type: "processed", invoices: saved });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- src/lib/invoices/build-failure-outcome.test.ts`
Expected: FAIL — cannot find module `./build-failure-outcome`.

- [ ] **Step 3: Implement `buildFailureOutcome`**

```ts
import type { SavedInvoiceSummary } from "./process-extraction";
import type { EmailReplyOutcome } from "../email-reply-templates";

/**
 * Decides the auto-reply outcome for process-inbound-email's onFailure hook.
 * onFailure fires once, after every retry attempt of the whole task has
 * thrown — but an earlier attempt may have already upserted some
 * attachments before a later attempt kept failing. Reporting "error"
 * unconditionally would tell the sender nothing was saved when some
 * invoices are actually sitting in their dashboard.
 */
export function buildFailureOutcome(saved: SavedInvoiceSummary[]): EmailReplyOutcome {
  return saved.length > 0 ? { type: "processed", invoices: saved } : { type: "error" };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- src/lib/invoices/build-failure-outcome.test.ts`
Expected: PASS (all 3 tests).

- [ ] **Step 5: Type-check and commit**

Run: `npx tsc --noEmit`

```bash
git add src/lib/invoices/build-failure-outcome.ts src/lib/invoices/build-failure-outcome.test.ts
git commit -m "$(cat <<'EOF'
feat: add buildFailureOutcome for process-inbound-email's onFailure

Pure function deciding processed-vs-error based on what was actually
saved, instead of always reporting error on task failure.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Fix `process-inbound-email.ts` retry duplication + `onFailure`

**Files:**
- Modify: `src/trigger/process-inbound-email.ts` (the `batchTriggerAndWait` call around
  current lines 116-126, and the `onFailure` hook at current lines 48-56)
- Modify: `docs/webhook-task-queue.md` (replace the "Known edge case (accepted for v1)"
  section, current lines 38-40; update the outcomes table's `error` row, current line 30)

**Interfaces:**
- Consumes: `buildFailureOutcome` from `@/lib/invoices/build-failure-outcome` (Task 6).

Not unit-tested (Trigger.dev task, excluded per `.claude/rules/testing.md`) — verified
manually per Step 3 below.

- [ ] **Step 1: Add the per-attachment idempotency key**

In `src/trigger/process-inbound-email.ts`, replace the `batchTriggerAndWait` call
(current lines 116-126):

```ts
      if (attachmentsToProcess.length > 0) {
        const batch = await tasks.batchTriggerAndWait<typeof processAttachment>(
          "process-attachment",
          attachmentsToProcess.map((attachment) => ({
            payload: {
              inboxId: payload.inboxId,
              messageId: payload.messageId,
              userId: inbox.user_id,
              attachment,
            } satisfies ProcessAttachmentPayload,
          })),
        );
```

with:

```ts
      if (attachmentsToProcess.length > 0) {
        const batch = await tasks.batchTriggerAndWait<typeof processAttachment>(
          "process-attachment",
          attachmentsToProcess.map((attachment) => ({
            payload: {
              inboxId: payload.inboxId,
              messageId: payload.messageId,
              userId: inbox.user_id,
              attachment,
            } satisfies ProcessAttachmentPayload,
            // A retry of process-inbound-email re-runs this whole function
            // from scratch, which would otherwise spawn a brand-new child
            // run per attachment on every retry. Keying by
            // messageId+attachmentId makes the retry reuse the same child
            // run instead of duplicating the download + extraction work.
            options: { idempotencyKey: `${payload.messageId}:${attachment.attachmentId}` },
          })),
        );
```

- [ ] **Step 2: Fix `onFailure` to check what was actually saved**

Add this import near the top of the file, alongside the existing `@/lib/invoices/*`
imports:

```ts
import { buildFailureOutcome } from "@/lib/invoices/build-failure-outcome";
```

Replace the `onFailure` hook (current lines 48-56):

```ts
  onFailure: async ({ payload }: { payload: ProcessInboundEmailPayload }) => {
    // Fires once, only after all retry attempts are exhausted.
    await triggerReply(
      payload.inboxId,
      payload.messageId,
      { type: "error" },
      `reply:error:${payload.messageId}`,
    );
  },
```

with:

```ts
  onFailure: async ({ payload }: { payload: ProcessInboundEmailPayload }) => {
    // Fires once, only after all retry attempts are exhausted. An earlier
    // attempt may have already upserted some attachments before a later
    // retry kept failing — check what actually landed instead of always
    // reporting "error" to the sender.
    const supabase = createServiceClient();
    const { data: rows } = await supabase
      .from("invoices")
      .select("vendor, amount, currency")
      .eq("source_message_id", payload.messageId);
    await triggerReply(
      payload.inboxId,
      payload.messageId,
      buildFailureOutcome(rows ?? []),
      `reply:error:${payload.messageId}`,
    );
  },
```

- [ ] **Step 3: Type-check and manual verification**

Run: `npx tsc --noEmit`

Manual verification (local Trigger.dev dev run, per `docs/webhook-task-queue.md`'s
existing local smoke test):
1. `npm run dev` and `npx trigger.dev@latest dev` in parallel.
2. Deliver a `message.received` webhook with 2 attachments where one is a valid invoice
   and one is crafted to make `processExtraction` throw on every attempt (e.g. point
   `AGENTMAIL_WEBHOOK_SECRET`-verified payload at an attachment id that 404s from
   `agentmail.inboxes.messages.getAttachment`, which makes `process-attachment` throw
   and exhaust its 3 retries).
3. Confirm in the Trigger.dev dashboard: the failing attachment's `process-attachment`
   run fails after 3 attempts; `process-inbound-email` still completes normally (since
   attachment failures are reported via `batch.runs[i].ok`, not a thrown exception) and
   sends a `processed` reply — this path doesn't hit `onFailure` at all, confirming
   `onFailure` truly is the rare all-attempts-of-the-parent-failed case.
4. To exercise `onFailure` itself, temporarily throw inside `process-inbound-email`'s
   `run()` after the batch call (e.g. `throw new Error("test")` right after line 149) with
   an inbox that has one attachment; verify after 3 parent retries the sender gets the
   `error` reply (since nothing was saved for that message), then remove the temporary
   throw.
5. Re-run step 2's scenario once more and confirm `idempotencyKey` prevents a duplicate
   `process-attachment` run from appearing in the dashboard if `process-inbound-email`
   itself is manually retried.

- [ ] **Step 4: Update the docs**

In `docs/webhook-task-queue.md`, replace the "Known edge case (accepted for v1)" section
(current lines 38-40):

```markdown
## Known edge case (accepted for v1)

If attachment A saves and attachment B then throws, the whole run retries. After retries are exhausted the sender gets an `error` reply even though A was upserted (and is visible in the dashboard). Upsert still prevents A from being duplicated across retries.
```

with:

```markdown
## Partial-failure retries

Each `batchTriggerAndWait` item carries `idempotencyKey: "<messageId>:<attachmentId>"`,
so if `process-inbound-email` itself retries (a failure unrelated to any single
attachment — attachment failures alone don't throw, they're reported via
`batch.runs[i].ok`), the retry reuses the same child runs instead of spawning
duplicates.

If `process-inbound-email` still exhausts all its own retries, `onFailure` queries
`invoices` by `source_message_id` before replying: any attachment that did save is
reported as `processed` with its invoices, instead of a blanket `error` reply that would
understate what actually landed.
```

Also update the outcomes table's `error` row (current line 30) from:

```markdown
| `error` | Only from the task `onFailure` hook after all retries are exhausted |
```

to:

```markdown
| `error` | From the task `onFailure` hook after all retries are exhausted, when nothing was saved for this message |
```

- [ ] **Step 5: Commit**

```bash
git add src/trigger/process-inbound-email.ts docs/webhook-task-queue.md
git commit -m "$(cat <<'EOF'
fix: report processed instead of error when a partial save preceded a retry exhaustion

process-inbound-email's onFailure always sent an "error" reply, even when
an earlier attempt had already saved some attachments before a later
retry kept failing. It now checks invoices by source_message_id and
reports what actually landed. Also key each batchTriggerAndWait item by
messageId+attachmentId so a parent retry reuses child runs instead of
duplicating them.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Final full-repo verification

After all 7 tasks:

- [ ] Run `npm run test` — expect all tests pass, including the ~14 new tests added
  across Tasks 1, 3, 4, 6.
- [ ] Run `npx tsc --noEmit` — expect zero errors.
- [ ] Run `npm run lint` — expect zero errors.
- [ ] Run `npm run build` — expect a clean production build.
