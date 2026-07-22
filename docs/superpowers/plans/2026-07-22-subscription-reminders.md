# Subscription Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect recurring (subscription) vendors from a user's existing invoices, and surface an in-dashboard "still using this?" confirmation on the `/dashboard/vendors` page (currently a placeholder) so users can catch and cancel forgotten subscriptions.

**Architecture:** Pure, unit-tested detection logic in `src/lib/subscriptions.ts` groups invoices by normalized vendor and classifies recurring patterns (monthly/yearly) from the median gap between invoice dates. A new `subscription_confirmations` table stores only the user's yes/no answer per vendor (everything else is recomputed from `invoices` on each page load — same pattern as `computeStats`/`monthlyTrend` in `src/lib/invoices.ts`). A Server Action writes confirmations via the service-role client, mirroring the existing `createInbox` action in `src/app/dashboard/actions.ts`.

**Tech Stack:** Next.js 16 App Router (Server Components + Server Actions), Supabase (Postgres + RLS), Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-22-subscription-reminders-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20260722200000_subscription_confirmations.sql` | New table + RLS + grants |
| `src/lib/subscriptions.ts` | Pure detection + eligibility logic (no I/O) |
| `src/lib/subscriptions.test.ts` | Unit tests for the above |
| `src/lib/validation/subscriptions.ts` | Zod schema for the confirm action's input |
| `src/lib/validation/subscriptions.test.ts` | Unit tests for the above |
| `src/app/dashboard/vendors/actions.ts` | `confirmSubscription` Server Action |
| `src/components/dashboard/vendors/subscription-confirm-buttons.tsx` | Client component: the two answer buttons |
| `src/app/dashboard/vendors/page.tsx` | Replaces `ComingSoon` — the real Vendors page |
| `src/lib/nav-config.ts` | Flip Vendors `status` from `"soon"` to `"live"` |

Existing files referenced (read, not modified): `src/lib/invoices.ts` (`InvoiceRow`, `normalizeInvoice`, `formatInvoiceMoney`), `src/lib/supabase/server.ts` (`createClient`), `src/lib/supabase/service.ts` (`createServiceClient`), `src/app/dashboard/actions.ts` (pattern reference for `createInbox`), `src/app/dashboard/settings/create-inbox-button.tsx` (pattern reference for the client button).

---

## Task 1: Migration — `subscription_confirmations` table

**Files:**
- Create: `supabase/migrations/20260722200000_subscription_confirmations.sql`

- [ ] **Step 1: Write the migration**

```sql
create table public.subscription_confirmations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vendor_key text not null,
  status text not null check (status in ('active', 'cancelled')),
  confirmed_at timestamptz not null default now(),
  unique (user_id, vendor_key)
);

alter table public.subscription_confirmations enable row level security;

create policy "Users can view their own subscription confirmations"
  on public.subscription_confirmations for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own subscription confirmations"
  on public.subscription_confirmations for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own subscription confirmations"
  on public.subscription_confirmations for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Newer Supabase defaults revoke Data API grants on new tables even with RLS
-- policies in place (see supabase/migrations/20260720110000_grant_table_privileges.sql
-- for the same gotcha hit earlier in this project).
grant select, insert, update on table public.subscription_confirmations to authenticated;
grant select, insert, update, delete on table public.subscription_confirmations to service_role;
```

- [ ] **Step 2: Apply it to the local Supabase instance and verify**

Run: `npx supabase db reset`
Expected output ends with: `Applying migration 20260722200000_subscription_confirmations.sql...` followed by `Finished supabase db reset on branch master.` with no errors. This reapplies every migration and the seed data (local dev only — see `supabase/seed.sql`).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260722200000_subscription_confirmations.sql
git commit -m "feat: add subscription_confirmations table"
```

---

## Task 2: Detection logic — `detectSubscriptions` + `normalizeVendorKey`

**Files:**
- Create: `src/lib/subscriptions.ts`
- Test: `src/lib/subscriptions.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/subscriptions.test.ts
import { describe, expect, it } from "vitest";
import { detectSubscriptions, normalizeVendorKey } from "./subscriptions";
import type { InvoiceRow } from "./invoices";

function makeInvoice(
  overrides: Partial<InvoiceRow> & { vendor: string; issue_date: string },
): InvoiceRow {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    vendor: overrides.vendor,
    invoice_number: overrides.invoice_number ?? null,
    amount: overrides.amount ?? 29,
    currency: overrides.currency ?? "USD",
    issue_date: overrides.issue_date,
    due_date: overrides.due_date ?? null,
    tax: overrides.tax ?? null,
    line_items: overrides.line_items ?? [],
    confidence_score: overrides.confidence_score ?? 0.95,
    source: overrides.source ?? "email",
    needs_review: overrides.needs_review ?? false,
    file_url: overrides.file_url ?? null,
    created_at: overrides.created_at ?? `${overrides.issue_date}T00:00:00.000Z`,
  };
}

describe("normalizeVendorKey", () => {
  it("collapses case and whitespace variants to the same key", () => {
    expect(normalizeVendorKey("Acme SaaS")).toBe("acme saas");
    expect(normalizeVendorKey("  acme   saas ")).toBe("acme saas");
    expect(normalizeVendorKey("ACME SAAS")).toBe("acme saas");
  });
});

describe("detectSubscriptions", () => {
  it("detects a monthly subscription from ~30-day gaps", () => {
    const invoices = [
      makeInvoice({ vendor: "Acme SaaS", issue_date: "2026-01-15" }),
      makeInvoice({ vendor: "Acme SaaS", issue_date: "2026-02-14" }),
      makeInvoice({ vendor: "Acme SaaS", issue_date: "2026-03-16" }),
    ];

    const result = detectSubscriptions(invoices);

    expect(result).toEqual([
      expect.objectContaining({
        vendorKey: "acme saas",
        cycle: "monthly",
        invoiceCount: 3,
        lastIssueDate: "2026-03-16",
        nextExpectedDate: "2026-04-15",
      }),
    ]);
  });

  it("detects a yearly subscription from ~365-day gaps", () => {
    const invoices = [
      makeInvoice({ vendor: "Annual Insurance Co", issue_date: "2025-01-10" }),
      makeInvoice({ vendor: "Annual Insurance Co", issue_date: "2026-01-10" }),
    ];

    const result = detectSubscriptions(invoices);

    expect(result).toEqual([
      expect.objectContaining({
        vendorKey: "annual insurance co",
        cycle: "yearly",
        invoiceCount: 2,
        lastIssueDate: "2026-01-10",
        nextExpectedDate: "2027-01-10",
      }),
    ]);
  });

  it("ignores vendors with irregular gaps", () => {
    const invoices = [
      makeInvoice({ vendor: "Random Vendor", issue_date: "2026-01-01" }),
      makeInvoice({ vendor: "Random Vendor", issue_date: "2026-01-11" }), // +10 days
      makeInvoice({ vendor: "Random Vendor", issue_date: "2026-04-11" }), // +90 days
    ];

    expect(detectSubscriptions(invoices)).toEqual([]);
  });

  it("ignores vendors with only one invoice", () => {
    const invoices = [makeInvoice({ vendor: "One-Off Vendor", issue_date: "2026-01-01" })];

    expect(detectSubscriptions(invoices)).toEqual([]);
  });

  it("groups multiple vendors independently", () => {
    const invoices = [
      makeInvoice({ vendor: "Acme SaaS", issue_date: "2026-01-15" }),
      makeInvoice({ vendor: "Acme SaaS", issue_date: "2026-02-14" }),
      makeInvoice({ vendor: "Annual Insurance Co", issue_date: "2025-01-10" }),
      makeInvoice({ vendor: "Annual Insurance Co", issue_date: "2026-01-10" }),
    ];

    const result = detectSubscriptions(invoices);

    expect(result).toHaveLength(2);
    expect(result.find((r) => r.vendorKey === "acme saas")?.cycle).toBe("monthly");
    expect(result.find((r) => r.vendorKey === "annual insurance co")?.cycle).toBe("yearly");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- src/lib/subscriptions.test.ts`
Expected: FAIL — `Cannot find module './subscriptions'` (the file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/subscriptions.ts
import type { InvoiceRow } from "./invoices";

export type SubscriptionCycle = "monthly" | "yearly";

export type SubscriptionCandidate = {
  vendorKey: string;
  vendorLabel: string;
  cycle: SubscriptionCycle;
  invoiceCount: number;
  lastAmount: number | null;
  currency: string | null;
  lastIssueDate: string;
  nextExpectedDate: string;
};

const CYCLE_DAYS: Record<SubscriptionCycle, number> = {
  monthly: 30,
  yearly: 365,
};

const MONTHLY_GAP_RANGE: [number, number] = [25, 35];
const YEARLY_GAP_RANGE: [number, number] = [350, 380];

export function normalizeVendorKey(vendor: string): string {
  return vendor.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseIsoDate(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m - 1, d];
}

function toUtcDate(iso: string): Date {
  const [y, m, d] = parseIsoDate(iso);
  return new Date(Date.UTC(y, m, d));
}

function daysBetween(a: string, b: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((toUtcDate(b).getTime() - toUtcDate(a).getTime()) / msPerDay);
}

export function addDays(iso: string, days: number): string {
  const date = toUtcDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function detectSubscriptions(invoices: InvoiceRow[]): SubscriptionCandidate[] {
  const groups = new Map<string, InvoiceRow[]>();

  for (const invoice of invoices) {
    if (!invoice.vendor || !invoice.issue_date) continue;
    const key = normalizeVendorKey(invoice.vendor);
    const group = groups.get(key) ?? [];
    group.push(invoice);
    groups.set(key, group);
  }

  const candidates: SubscriptionCandidate[] = [];

  for (const [vendorKey, group] of groups) {
    if (group.length < 2) continue;

    const sorted = [...group].sort((a, b) =>
      a.issue_date! < b.issue_date! ? -1 : a.issue_date! > b.issue_date! ? 1 : 0,
    );

    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(daysBetween(sorted[i - 1].issue_date!, sorted[i].issue_date!));
    }

    const gapMedian = median(gaps);
    let cycle: SubscriptionCycle | null = null;
    if (gapMedian >= MONTHLY_GAP_RANGE[0] && gapMedian <= MONTHLY_GAP_RANGE[1]) {
      cycle = "monthly";
    } else if (gapMedian >= YEARLY_GAP_RANGE[0] && gapMedian <= YEARLY_GAP_RANGE[1]) {
      cycle = "yearly";
    }
    if (!cycle) continue;

    const last = sorted[sorted.length - 1];

    candidates.push({
      vendorKey,
      vendorLabel: last.vendor!,
      cycle,
      invoiceCount: sorted.length,
      lastAmount: last.amount,
      currency: last.currency,
      lastIssueDate: last.issue_date!,
      nextExpectedDate: addDays(last.issue_date!, CYCLE_DAYS[cycle]),
    });
  }

  return candidates;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- src/lib/subscriptions.test.ts`
Expected: PASS — 6 tests (1 in `normalizeVendorKey`, 5 in `detectSubscriptions`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/subscriptions.ts src/lib/subscriptions.test.ts
git commit -m "feat: add subscription detection logic"
```

---

## Task 3: Eligibility logic — `withConfirmationStatus`

**Files:**
- Modify: `src/lib/subscriptions.ts` (append)
- Modify: `src/lib/subscriptions.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/subscriptions.test.ts`:

```ts
import { withConfirmationStatus } from "./subscriptions";

describe("withConfirmationStatus", () => {
  const candidate = {
    vendorKey: "acme saas",
    vendorLabel: "Acme SaaS",
    cycle: "monthly" as const,
    invoiceCount: 3,
    lastAmount: 29,
    currency: "USD",
    lastIssueDate: "2026-03-16",
    nextExpectedDate: "2026-04-15",
  };

  it("marks a subscription as due when today is inside the reminder window and unconfirmed", () => {
    const today = new Date("2026-04-14T00:00:00.000Z");
    const [result] = withConfirmationStatus([candidate], new Map(), today);
    expect(result.status).toBe("due");
    expect(result.needsConfirmation).toBe(true);
  });

  it("marks a subscription as upcoming when today is before the reminder window", () => {
    const today = new Date("2026-03-20T00:00:00.000Z");
    const [result] = withConfirmationStatus([candidate], new Map(), today);
    expect(result.status).toBe("upcoming");
    expect(result.needsConfirmation).toBe(false);
  });

  it("marks a subscription as confirmed_active when confirmed within the current cycle", () => {
    const confirmations = new Map([
      ["acme saas", { status: "active" as const, confirmedAt: "2026-03-18T00:00:00.000Z" }],
    ]);
    const today = new Date("2026-04-14T00:00:00.000Z");
    const [result] = withConfirmationStatus([candidate], confirmations, today);
    expect(result.status).toBe("confirmed_active");
    expect(result.needsConfirmation).toBe(false);
  });

  it("marks a subscription as cancelled when the user said so, regardless of window", () => {
    const confirmations = new Map([
      ["acme saas", { status: "cancelled" as const, confirmedAt: "2026-03-18T00:00:00.000Z" }],
    ]);
    const today = new Date("2026-04-14T00:00:00.000Z");
    const [result] = withConfirmationStatus([candidate], confirmations, today);
    expect(result.status).toBe("cancelled");
    expect(result.needsConfirmation).toBe(false);
  });
});
```

(Move the `import { withConfirmationStatus } from "./subscriptions";` line up into the existing `import { detectSubscriptions, normalizeVendorKey } from "./subscriptions";` line instead of a second import statement — end state is one combined import.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- src/lib/subscriptions.test.ts`
Expected: FAIL — `withConfirmationStatus is not a function` / `Cannot find export`.

- [ ] **Step 3: Write the implementation**

Append to `src/lib/subscriptions.ts`:

```ts
export type SubscriptionStatus = "upcoming" | "due" | "confirmed_active" | "cancelled";

export type SubscriptionWithStatus = SubscriptionCandidate & {
  status: SubscriptionStatus;
  needsConfirmation: boolean;
};

export type SubscriptionConfirmation = {
  status: "active" | "cancelled";
  confirmedAt: string; // ISO datetime
};

const REMINDER_WINDOW_BEFORE_DAYS = 3;
const REMINDER_WINDOW_AFTER_DAYS = 21;

export function withConfirmationStatus(
  candidates: SubscriptionCandidate[],
  confirmations: Map<string, SubscriptionConfirmation>,
  today: Date = new Date(),
): SubscriptionWithStatus[] {
  const todayIso = today.toISOString().slice(0, 10);

  return candidates.map((candidate) => {
    const confirmation = confirmations.get(candidate.vendorKey);
    const windowStart = addDays(candidate.nextExpectedDate, -REMINDER_WINDOW_BEFORE_DAYS);
    const windowEnd = addDays(candidate.nextExpectedDate, REMINDER_WINDOW_AFTER_DAYS);
    const inWindow = todayIso >= windowStart && todayIso <= windowEnd;

    if (confirmation?.status === "cancelled") {
      return { ...candidate, status: "cancelled" as const, needsConfirmation: false };
    }

    if (confirmation?.status === "active") {
      const cycleStart = addDays(candidate.nextExpectedDate, -CYCLE_DAYS[candidate.cycle]);
      const confirmedAtIso = confirmation.confirmedAt.slice(0, 10);
      if (confirmedAtIso >= cycleStart) {
        return { ...candidate, status: "confirmed_active" as const, needsConfirmation: false };
      }
    }

    if (inWindow) {
      return { ...candidate, status: "due" as const, needsConfirmation: true };
    }

    return { ...candidate, status: "upcoming" as const, needsConfirmation: false };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- src/lib/subscriptions.test.ts`
Expected: PASS — 10 tests total (6 from Task 2 + 4 from this task).

- [ ] **Step 5: Commit**

```bash
git add src/lib/subscriptions.ts src/lib/subscriptions.test.ts
git commit -m "feat: add subscription reminder eligibility logic"
```

---

## Task 4: Validation — `confirmSubscription` input

**Files:**
- Create: `src/lib/validation/subscriptions.ts`
- Test: `src/lib/validation/subscriptions.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/validation/subscriptions.test.ts
import { describe, expect, it } from "vitest";
import { parseConfirmSubscriptionInput } from "./subscriptions";

describe("parseConfirmSubscriptionInput", () => {
  it("accepts a valid active confirmation", () => {
    const result = parseConfirmSubscriptionInput({ vendorKey: "acme saas", status: "active" });
    expect(result).toEqual({ success: true, data: { vendorKey: "acme saas", status: "active" } });
  });

  it("accepts a valid cancelled confirmation", () => {
    const result = parseConfirmSubscriptionInput({ vendorKey: "acme saas", status: "cancelled" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty vendorKey", () => {
    const result = parseConfirmSubscriptionInput({ vendorKey: "", status: "active" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid status value", () => {
    const result = parseConfirmSubscriptionInput({ vendorKey: "acme saas", status: "paused" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing vendorKey", () => {
    const result = parseConfirmSubscriptionInput({ status: "active" });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- src/lib/validation/subscriptions.test.ts`
Expected: FAIL — `Cannot find module './subscriptions'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/validation/subscriptions.ts
import { z } from "zod";

export const confirmSubscriptionSchema = z.object({
  vendorKey: z.string().trim().min(1, "vendorKey is required").max(200),
  status: z.enum(["active", "cancelled"]),
});

export type ConfirmSubscriptionInput = z.infer<typeof confirmSubscriptionSchema>;

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export function parseConfirmSubscriptionInput(
  input: unknown,
): ValidationResult<ConfirmSubscriptionInput> {
  const result = confirmSubscriptionSchema.safeParse(input);
  if (!result.success) {
    return { success: false, error: result.error.issues[0]?.message ?? "Invalid input" };
  }
  return { success: true, data: result.data };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- src/lib/validation/subscriptions.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validation/subscriptions.ts src/lib/validation/subscriptions.test.ts
git commit -m "feat: add validation for subscription confirmation input"
```

---

## Task 5: Server Action — `confirmSubscription`

**Files:**
- Create: `src/app/dashboard/vendors/actions.ts`

- [ ] **Step 1: Write the action**

```ts
// src/app/dashboard/vendors/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { parseConfirmSubscriptionInput } from "@/lib/validation/subscriptions";

export type ConfirmSubscriptionResult = { ok: true } | { ok: false; error: string };

// Upserts the user's yes/no answer for one vendor. Uses the service-role
// client (bypassing RLS) after an explicit auth check, matching the
// createInbox pattern in src/app/dashboard/actions.ts.
export async function confirmSubscription(
  vendorKey: string,
  status: "active" | "cancelled",
): Promise<ConfirmSubscriptionResult> {
  const parsed = parseConfirmSubscriptionInput({ vendorKey, status });
  if (!parsed.success) {
    return { ok: false, error: parsed.error };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { error } = await service.from("subscription_confirmations").upsert(
    {
      user_id: user.id,
      vendor_key: parsed.data.vendorKey,
      status: parsed.data.status,
      confirmed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,vendor_key" },
  );

  if (error) {
    console.error("Failed to save subscription confirmation", user.id, error);
    return { ok: false, error: "Could not save your answer. Please try again." };
  }

  revalidatePath("/dashboard/vendors");
  return { ok: true };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors from this file. (The project already has pre-existing unrelated errors in `src/app/dashboard/inbox/*` — ignore those, don't fix them as part of this plan.)

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/vendors/actions.ts
git commit -m "feat: add confirmSubscription server action"
```

---

## Task 6: Client component — confirm buttons

**Files:**
- Create: `src/components/dashboard/vendors/subscription-confirm-buttons.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/components/dashboard/vendors/subscription-confirm-buttons.tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { confirmSubscription } from "@/app/dashboard/vendors/actions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function SubscriptionConfirmButtons({ vendorKey }: { vendorKey: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function answer(status: "active" | "cancelled") {
    startTransition(async () => {
      const result = await confirmSubscription(vendorKey, status);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        status === "active" ? "Got it — we'll ask again next cycle." : "Marked as cancelled.",
      );
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        className="bg-[#E8FF47] text-[#0a0a0a] hover:bg-[#E8FF47]/90"
        disabled={isPending}
        onClick={() => answer("active")}
      >
        {isPending ? <Spinner data-icon="inline-start" /> : <Check data-icon="inline-start" />}
        Still using it
      </Button>
      <Button size="sm" variant="outline" disabled={isPending} onClick={() => answer("cancelled")}>
        <X data-icon="inline-start" />
        Cancelled
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors from this file.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/vendors/subscription-confirm-buttons.tsx
git commit -m "feat: add subscription confirm buttons component"
```

---

## Task 7: Vendors page + nav status

**Files:**
- Modify: `src/app/dashboard/vendors/page.tsx` (replace entire file — currently renders `ComingSoon`)
- Modify: `src/lib/nav-config.ts:41` (the Vendors entry's `status` field)

- [ ] **Step 1: Replace the Vendors page**

```tsx
// src/app/dashboard/vendors/page.tsx
import { Users } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { ContentShell } from "@/components/dashboard/content-shell"
import { SubscriptionConfirmButtons } from "@/components/dashboard/vendors/subscription-confirm-buttons"
import { Badge } from "@/components/ui/badge"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { formatInvoiceMoney, normalizeInvoice } from "@/lib/invoices"
import {
  detectSubscriptions,
  normalizeVendorKey,
  withConfirmationStatus,
  type SubscriptionConfirmation,
} from "@/lib/subscriptions"

function CycleBadge({ cycle }: { cycle: "monthly" | "yearly" }) {
  return (
    <Badge variant="outline" className="border-[#E8FF47]/35 bg-[#E8FF47]/10 text-[#E8FF47]">
      {cycle === "monthly" ? "Monthly" : "Yearly"}
    </Badge>
  )
}

export default async function VendorsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: invoiceRows }, { data: confirmationRows }] = await Promise.all([
    supabase
      .from("invoices")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("subscription_confirmations")
      .select("vendor_key, status, confirmed_at")
      .eq("user_id", user!.id),
  ])

  const invoices = (invoiceRows ?? []).map(normalizeInvoice)

  const confirmations = new Map<string, SubscriptionConfirmation>(
    (confirmationRows ?? []).map((row) => [
      row.vendor_key,
      { status: row.status as "active" | "cancelled", confirmedAt: row.confirmed_at },
    ]),
  )

  const subscriptions = withConfirmationStatus(detectSubscriptions(invoices), confirmations)
  const due = subscriptions.filter((s) => s.needsConfirmation)

  const vendorTotals = new Map<
    string,
    { label: string; total: number; currency: string | null; count: number; lastDate: string }
  >()
  for (const invoice of invoices) {
    if (!invoice.vendor) continue
    const key = normalizeVendorKey(invoice.vendor)
    const existing = vendorTotals.get(key)
    if (existing) {
      existing.total += invoice.amount ?? 0
      existing.count += 1
      if (invoice.issue_date && invoice.issue_date > existing.lastDate) {
        existing.lastDate = invoice.issue_date
      }
    } else {
      vendorTotals.set(key, {
        label: invoice.vendor,
        total: invoice.amount ?? 0,
        currency: invoice.currency,
        count: 1,
        lastDate: invoice.issue_date ?? "",
      })
    }
  }

  return (
    <ContentShell
      title="Vendors"
      description="Every vendor seen in your invoices, with subscription reminders for recurring charges."
    >
      <div className="flex flex-col gap-5">
        {due.length > 0 ? (
          <section className="rounded-xl border border-[#E8FF47]/25 bg-[#E8FF47]/[0.04]">
            <div className="border-b border-[#E8FF47]/20 px-4 py-3">
              <h2 className="text-sm font-semibold tracking-tight">Needs your confirmation</h2>
              <p className="text-xs text-muted-foreground">
                These look like recurring charges. Still using them?
              </p>
            </div>
            <ul className="divide-y divide-border">
              {due.map((sub) => (
                <li
                  key={sub.vendorKey}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{sub.vendorLabel}</p>
                      <CycleBadge cycle={sub.cycle} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Last charge {formatInvoiceMoney(sub.lastAmount, sub.currency)} on{" "}
                      {sub.lastIssueDate}
                    </p>
                  </div>
                  <SubscriptionConfirmButtons vendorKey={sub.vendorKey} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="rounded-xl border border-border bg-card/40">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold tracking-tight">All vendors</h2>
            <p className="text-xs text-muted-foreground">{vendorTotals.size} vendor(s)</p>
          </div>

          {vendorTotals.size === 0 ? (
            <Empty className="border-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Users />
                </EmptyMedia>
                <EmptyTitle>No vendors yet</EmptyTitle>
                <EmptyDescription>
                  Vendors appear here once you have invoices with a vendor name.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="divide-y divide-border">
              {[...vendorTotals.entries()]
                .sort((a, b) => b[1].total - a[1].total)
                .map(([key, vendor]) => {
                  const sub = subscriptions.find((s) => s.vendorKey === key)
                  return (
                    <li
                      key={key}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-medium">{vendor.label}</p>
                          {sub ? <CycleBadge cycle={sub.cycle} /> : null}
                          {sub?.status === "cancelled" ? (
                            <Badge variant="secondary">Cancelled</Badge>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {vendor.count} invoice(s) · last {vendor.lastDate || "—"}
                        </p>
                      </div>
                      <p className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                        {formatInvoiceMoney(vendor.total, vendor.currency)}
                      </p>
                    </li>
                  )
                })}
            </ul>
          )}
        </section>
      </div>
    </ContentShell>
  )
}
```

- [ ] **Step 2: Flip the nav status**

In `src/lib/nav-config.ts`, find the Vendors entry (in the `Workspace` group):

```ts
      {
        label: "Vendors",
        href: "/dashboard/vendors",
        icon: Users,
        status: "soon",
      },
```

Change `status: "soon"` to `status: "live"`.

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: no new errors (same pre-existing `dashboard/inbox` errors as before, untouched).

Run: `npx eslint .`
Expected: 0 errors, 0 warnings.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/vendors/page.tsx src/lib/nav-config.ts
git commit -m "feat: build the Vendors page with subscription reminders"
```

---

## Task 8: Full verification

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all suites pass, including the 15 new tests from Tasks 2–4 (`src/lib/subscriptions.test.ts` ×10, `src/lib/validation/subscriptions.test.ts` ×5).

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: build succeeds; route list includes `ƒ /dashboard/vendors`.

- [ ] **Step 3: Manual smoke test against local Supabase**

Prerequisite: local Supabase running (`npx supabase status` shows `API URL` set) and the dev server running.

Insert two synthetic same-vendor invoices ~30 days apart, dated so `nextExpectedDate` falls within today's reminder window, for the seeded admin user:

```bash
npx supabase db query "insert into public.invoices (user_id, source, vendor, amount, currency, issue_date, created_at) values ('00000000-0000-0000-0000-000000000001', 'upload', 'Smoke Test SaaS', 19, 'USD', (current_date - interval '33 days')::date, now()), ('00000000-0000-0000-0000-000000000001', 'upload', 'Smoke Test SaaS', 19, 'USD', (current_date - interval '3 days')::date, now())"
```

Then in the browser: log in as `admin@local.test` / `admin12345`, open `/dashboard/vendors`. Expected: "Needs your confirmation" section shows "Smoke Test SaaS" with a Monthly badge and two buttons. Click "Still using it" → toast confirms, the row disappears from "Needs your confirmation" (still listed under "All vendors"). Reload the page → it stays gone (confirmation persisted).

- [ ] **Step 4: Update the graph and record the feature**

Run: `code-review-graph update` (if not already covered by the PostToolUse hook)

Create `docs/subscription-reminders.md` recording: what the feature does, the detection heuristic (median gap, monthly/yearly ranges), the reminder window, and that manual "mark as subscription" + email reminders are deliberately out of scope for v1 (per the design spec's Out of Scope section).

- [ ] **Step 5: Final commit**

```bash
git add docs/subscription-reminders.md
git commit -m "docs: record subscription reminders feature"
```
