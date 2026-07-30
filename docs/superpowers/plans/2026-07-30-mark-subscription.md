# Mark As Subscription — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users manually mark a vendor as a monthly/yearly subscription when the auto-detector misses them.

**Architecture:** Extend `subscription_confirmations` with `origin` and `cycle` columns. Add pure `buildManualCandidates` + `mergeSubscriptionCandidates` to `src/lib/subscriptions.ts`. Wire `markVendorAsSubscription` Server Action and a dropdown button into the vendor detail Sheet.

**Tech Stack:** TypeScript, Next.js, Supabase (Postgres), Vitest, Zod, shadcn/ui

## Global Constraints

- Follow `.claude/rules/` conventions (code-style, naming, validation, constants, testing, data-safety)
- Soft delete only — never physically delete user data without explicit user request
- Return `{ ok: true } | { ok: false; error: string }` from Server Actions
- Validate all input via `src/lib/validation/*.ts` before touching DB
- Unit test all pure `src/lib/` logic with Vitest
- Use `createServiceClient()` for writes after `requireUser()` auth check

---

### Task 1: Migration — origin + cycle on subscription_confirmations

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_subscription_manual_mark.sql`

- [ ] Add `origin text not null default 'reminder' check (origin in ('reminder', 'manual'))`
- [ ] Add `cycle text check (cycle in ('monthly', 'yearly'))`
- [ ] Grant existing privileges for the updated table

```sql
-- Add origin column with check constraint
alter table public.subscription_confirmations
  add column if not exists origin text not null default 'reminder'
  check (origin in ('reminder', 'manual'));

-- Add cycle column with check constraint (nullable — only for manual)
alter table public.subscription_confirmations
  add column if not exists cycle text
  check (cycle is null or cycle in ('monthly', 'yearly'));

-- Grant on updated table (service_role already has all, but be explicit)
grant select, insert, update on table public.subscription_confirmations to authenticated;
grant select, insert, update, delete on table public.subscription_confirmations to service_role;
```

---

### Task 2: Constants + Validation

**Files:**
- Modify: `src/constants/subscriptions.ts`
- Modify: `src/lib/validation/subscriptions.ts`
- Modify: `src/lib/validation/subscriptions.test.ts` (create if missing)

**Interfaces:**
- Produces: `SUBSCRIPTION_ORIGIN` constant object, `SubscriptionOrigin` type
- Produces: `parseMarkSubscriptionInput(input: unknown): ValidationResult<MarkSubscriptionInput>`
- Produces: `MarkSubscriptionInput = { vendorKey: string; cycle: "monthly" | "yearly" }`

- [ ] Add to `src/constants/subscriptions.ts`:

```ts
export const SUBSCRIPTION_ORIGIN = {
  REMINDER: "reminder",
  MANUAL: "manual",
} as const

export type SubscriptionOrigin =
  (typeof SUBSCRIPTION_ORIGIN)[keyof typeof SUBSCRIPTION_ORIGIN]
```

- [ ] Add to `src/lib/validation/subscriptions.ts`:

```ts
import { SUBSCRIPTION_CYCLE } from "@/constants/subscriptions"

export const markSubscriptionSchema = z.object({
  vendorKey: vendorKeySchema,
  cycle: z.enum([SUBSCRIPTION_CYCLE.MONTHLY, SUBSCRIPTION_CYCLE.YEARLY]),
})

export type MarkSubscriptionInput = z.infer<typeof markSubscriptionSchema>

export function parseMarkSubscriptionInput(
  input: unknown,
): ValidationResult<MarkSubscriptionInput> {
  const result = markSubscriptionSchema.safeParse(input)
  if (!result.success) {
    return { success: false, error: result.error.issues[0]?.message ?? "Invalid input" }
  }
  return { success: true, data: result.data }
}
```

- [ ] Add tests in `src/lib/validation/subscriptions.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { parseMarkSubscriptionInput } from "./subscriptions"

describe("parseMarkSubscriptionInput", () => {
  it("accepts a valid vendorKey and monthly cycle", () => {
    const result = parseMarkSubscriptionInput({ vendorKey: "acme", cycle: "monthly" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.vendorKey).toBe("acme")
      expect(result.data.cycle).toBe("monthly")
    }
  })

  it("accepts yearly cycle", () => {
    const result = parseMarkSubscriptionInput({ vendorKey: "acme", cycle: "yearly" })
    expect(result.success).toBe(true)
  })

  it("rejects missing vendorKey", () => {
    const result = parseMarkSubscriptionInput({ cycle: "monthly" })
    expect(result.success).toBe(false)
  })

  it("rejects invalid cycle", () => {
    const result = parseMarkSubscriptionInput({ vendorKey: "acme", cycle: "weekly" })
    expect(result.success).toBe(false)
  })

  it("rejects empty vendorKey", () => {
    const result = parseMarkSubscriptionInput({ vendorKey: "", cycle: "monthly" })
    expect(result.success).toBe(false)
  })
})
```

- [ ] Run tests: `npx vitest run src/lib/validation/subscriptions.test.ts`
- [ ] Commit

---

### Task 3: Pure lib — buildManualCandidates + mergeSubscriptionCandidates

**Files:**
- Modify: `src/lib/subscriptions.ts`
- Modify: `src/lib/subscriptions.test.ts`

**Interfaces:**
- Consumes: `InvoiceRow` from `src/lib/invoices.ts`, existing `CYCLE_DAYS`, `addDays`
- Produces:
  ```ts
  type ManualSubscriptionRow = { vendor_key: string; cycle: string; status: string }
  
  function buildManualCandidates(
    invoices: InvoiceRow[],
    manualRows: ManualSubscriptionRow[],
  ): SubscriptionCandidate[]
  
  function mergeSubscriptionCandidates(
    detected: SubscriptionCandidate[],
    manual: SubscriptionCandidate[],
  ): SubscriptionCandidate[]
  ```

- [ ] Add to `src/lib/subscriptions.ts` after `detectSubscriptions`:

```ts
export type ManualSubscriptionRow = {
  vendor_key: string
  cycle: string
  status: string
}

/** Build synthetic SubscriptionCandidates from manually-marked rows.
 *  Each manual row uses the latest invoice for that vendorKey to derive
 *  lastAmount/currency/lastIssueDate/nextExpectedDate. Vendors with zero
 *  invoices are silently dropped — the Server Action guards this upstream. */
export function buildManualCandidates(
  invoices: InvoiceRow[],
  manualRows: ManualSubscriptionRow[],
): SubscriptionCandidate[] {
  // Group invoices by vendor key, keep only the latest per vendor
  const latestByKey = new Map<string, InvoiceRow>()
  for (const invoice of invoices) {
    if (!invoice.vendor || !invoice.issue_date) continue
    const key = normalizeVendorKey(invoice.vendor)
    const existing = latestByKey.get(key)
    if (!existing || invoice.issue_date > existing.issue_date!) {
      latestByKey.set(key, invoice)
    }
  }

  const candidates: SubscriptionCandidate[] = []

  for (const row of manualRows) {
    const key = normalizeVendorKey(row.vendor_key)
    const latest = latestByKey.get(key)
    if (!latest) continue // no invoices — skip (Server Action guards upstream)

    const cycle = row.cycle as SubscriptionCycle
    candidates.push({
      vendorKey: key,
      vendorLabel: latest.vendor!,
      cycle,
      invoiceCount: 1, // manual mark — we don't count all invoices
      lastAmount: latest.amount,
      currency: latest.currency,
      lastIssueDate: latest.issue_date!,
      nextExpectedDate: addDays(latest.issue_date!, CYCLE_DAYS[cycle]),
    })
  }

  return candidates
}

/** Merge detected and manual candidates. Manual overrides detected for the
 *  same vendorKey (manual mark wins when both exist). */
export function mergeSubscriptionCandidates(
  detected: SubscriptionCandidate[],
  manual: SubscriptionCandidate[],
): SubscriptionCandidate[] {
  const manualKeys = new Set(manual.map((m) => m.vendorKey))
  const filtered = detected.filter((d) => !manualKeys.has(d.vendorKey))
  return [...filtered, ...manual]
}
```

- [ ] Add tests in `src/lib/subscriptions.test.ts`:

```ts
import {
  buildManualCandidates,
  mergeSubscriptionCandidates,
} from "./subscriptions"
import type { ManualSubscriptionRow } from "./subscriptions"

describe("buildManualCandidates", () => {
  it("builds a candidate from a single invoice for a manually marked vendor", () => {
    const invoices = [
      makeInvoice({ vendor: "One Off SaaS", issue_date: "2026-07-01", amount: 49 }),
    ]
    const manualRows: ManualSubscriptionRow[] = [
      { vendor_key: "one off saas", cycle: "monthly", status: "active" },
    ]

    const result = buildManualCandidates(invoices, manualRows)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      vendorKey: "one off saas",
      cycle: "monthly",
      lastIssueDate: "2026-07-01",
      nextExpectedDate: "2026-07-31",
      lastAmount: 49,
    })
  })

  it("uses the latest invoice when multiple exist for a manual vendor", () => {
    const invoices = [
      makeInvoice({ vendor: "Growing SaaS", issue_date: "2026-06-01", amount: 29 }),
      makeInvoice({ vendor: "Growing SaaS", issue_date: "2026-07-15", amount: 99 }),
    ]
    const manualRows: ManualSubscriptionRow[] = [
      { vendor_key: "growing saas", cycle: "monthly", status: "active" },
    ]

    const result = buildManualCandidates(invoices, manualRows)

    expect(result).toHaveLength(1)
    expect(result[0].lastIssueDate).toBe("2026-07-15")
    expect(result[0].lastAmount).toBe(99)
    expect(result[0].nextExpectedDate).toBe("2026-08-14")
  })

  it("skips vendors with no invoices", () => {
    const manualRows: ManualSubscriptionRow[] = [
      { vendor_key: "ghost vendor", cycle: "monthly", status: "active" },
    ]

    expect(buildManualCandidates([], manualRows)).toEqual([])
  })

  it("builds yearly candidates", () => {
    const invoices = [
      makeInvoice({ vendor: "Annual Thing", issue_date: "2026-01-10", amount: 120 }),
    ]
    const manualRows: ManualSubscriptionRow[] = [
      { vendor_key: "annual thing", cycle: "yearly", status: "active" },
    ]

    const result = buildManualCandidates(invoices, manualRows)
    expect(result[0].cycle).toBe("yearly")
    expect(result[0].nextExpectedDate).toBe("2027-01-10")
  })

  it("builds multiple manual candidates independently", () => {
    const invoices = [
      makeInvoice({ vendor: "SaaS A", issue_date: "2026-07-01" }),
      makeInvoice({ vendor: "SaaS B", issue_date: "2026-07-15" }),
    ]
    const manualRows: ManualSubscriptionRow[] = [
      { vendor_key: "saas a", cycle: "monthly", status: "active" },
      { vendor_key: "saas b", cycle: "yearly", status: "active" },
    ]

    expect(buildManualCandidates(invoices, manualRows)).toHaveLength(2)
  })
})

describe("mergeSubscriptionCandidates", () => {
  const detected = [
    {
      vendorKey: "auto-detected",
      vendorLabel: "Auto Detected",
      cycle: "monthly" as const,
      invoiceCount: 3,
      lastAmount: 29,
      currency: "USD",
      lastIssueDate: "2026-07-01",
      nextExpectedDate: "2026-07-31",
    },
  ]

  const manual = [
    {
      vendorKey: "manual-only",
      vendorLabel: "Manual Only",
      cycle: "yearly" as const,
      invoiceCount: 1,
      lastAmount: 99,
      currency: "USD",
      lastIssueDate: "2026-07-15",
      nextExpectedDate: "2027-07-15",
    },
  ]

  it("combines detected and manual candidates", () => {
    const result = mergeSubscriptionCandidates(detected, manual)
    expect(result).toHaveLength(2)
    expect(result.map((r) => r.vendorKey).sort()).toEqual(["auto-detected", "manual-only"])
  })

  it("manual overrides detected for the same vendorKey", () => {
    const manualOverride = [
      {
        vendorKey: "auto-detected",
        vendorLabel: "Auto Detected (Manual)",
        cycle: "yearly" as const,
        invoiceCount: 1,
        lastAmount: 49,
        currency: "EUR",
        lastIssueDate: "2026-08-01",
        nextExpectedDate: "2027-08-01",
      },
    ]

    const result = mergeSubscriptionCandidates(detected, manualOverride)
    expect(result).toHaveLength(1)
    expect(result[0].cycle).toBe("yearly")
    expect(result[0].lastAmount).toBe(49)
  })

  it("returns only manual when no detected exist", () => {
    expect(mergeSubscriptionCandidates([], manual)).toHaveLength(1)
  })

  it("returns only detected when no manual exist", () => {
    expect(mergeSubscriptionCandidates(detected, [])).toEqual(detected)
  })
})
```

- [ ] Run tests: `npx vitest run src/lib/subscriptions.test.ts`
- [ ] Commit

---

### Task 4: Server Action — markVendorAsSubscription

**Files:**
- Modify: `src/app/dashboard/vendors/actions.ts`

**Interfaces:**
- Consumes: `parseMarkSubscriptionInput`, `requireUser`, `createServiceClient`
- Produces: `markVendorAsSubscription(vendorKey: string, cycle: "monthly" | "yearly"): Promise<ConfirmSubscriptionResult>`

- [ ] Add to `src/app/dashboard/vendors/actions.ts`:

```ts
import { parseMarkSubscriptionInput } from "@/lib/validation/subscriptions"

export async function markVendorAsSubscription(
  vendorKey: string,
  cycle: "monthly" | "yearly",
): Promise<ConfirmSubscriptionResult> {
  const parsed = parseMarkSubscriptionInput({ vendorKey, cycle })
  if (!parsed.success) {
    return { ok: false, error: parsed.error }
  }

  const user = await requireUser()
  const service = createServiceClient()

  const { error } = await service.from("subscription_confirmations").upsert(
    {
      user_id: user.id,
      vendor_key: parsed.data.vendorKey,
      status: "active",
      origin: "manual",
      cycle: parsed.data.cycle,
      confirmed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,vendor_key" },
  )

  if (error) {
    console.error("Failed to mark vendor as subscription", user.id, error)
    return { ok: false, error: "Could not mark as subscription. Please try again." }
  }

  revalidatePath("/dashboard/vendors")
  return { ok: true }
}
```

- [ ] Run `npx tsc --noEmit` to verify types
- [ ] Commit

---

### Task 5: UI — mark-subscription-button + wire into vendors-list Sheet

**Files:**
- Create: `src/components/dashboard/vendors/mark-subscription-button.tsx`
- Modify: `src/components/dashboard/vendors/vendors-list.tsx`

**Interfaces:**
- Consumes: `markVendorAsSubscription` from `@/app/dashboard/vendors/actions`
- Produces: `<MarkSubscriptionButton vendorKey={string} />` component

- [ ] Create `src/components/dashboard/vendors/mark-subscription-button.tsx`:

```tsx
"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Tag } from "lucide-react"
import {
  SUBSCRIPTION_CYCLE,
  SUBSCRIPTION_CYCLE_LABELS,
  type SubscriptionCycleConstant,
} from "@/constants/subscriptions"
import { markVendorAsSubscription } from "@/app/dashboard/vendors/actions"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Spinner } from "@/components/ui/spinner"

const CYCLES: SubscriptionCycleConstant[] = [
  SUBSCRIPTION_CYCLE.MONTHLY,
  SUBSCRIPTION_CYCLE.YEARLY,
]

export function MarkSubscriptionButton({ vendorKey }: { vendorKey: string }) {
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const router = useRouter()

  function mark(cycle: SubscriptionCycleConstant) {
    startTransition(async () => {
      const result = await markVendorAsSubscription(vendorKey, cycle)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(`Marked as ${SUBSCRIPTION_CYCLE_LABELS[cycle]} subscription.`)
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={isPending}>
          {isPending ? <Spinner data-icon="inline-start" /> : <Tag data-icon="inline-start" />}
          Mark as subscription
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {CYCLES.map((cycle) => (
          <DropdownMenuItem
            key={cycle}
            disabled={isPending}
            onClick={() => mark(cycle)}
          >
            {SUBSCRIPTION_CYCLE_LABELS[cycle]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

- [ ] In `src/components/dashboard/vendors/vendors-list.tsx`, import and wire the button:
  - Import: `import { MarkSubscriptionButton } from "@/components/dashboard/vendors/mark-subscription-button"`
  - After the Edit/Delete button row (around line 251), add when `!selected.subscription`:

```tsx
{!selected.subscription && selected.count > 0 ? (
  <MarkSubscriptionButton vendorKey={selected.key} />
) : null}
```

- [ ] Commit

---

### Task 6: Update vendors page pipeline

**Files:**
- Modify: `src/app/dashboard/vendors/page.tsx`

**Interfaces:**
- Consumes: `buildManualCandidates`, `mergeSubscriptionCandidates`, `ManualSubscriptionRow` from `@/lib/subscriptions`
- Selects `origin, cycle` from subscription_confirmations query

- [ ] Update the subscription_confirmations select to include `origin` and `cycle`:

Change:
```ts
.select("vendor_key, status, confirmed_at")
```
To:
```ts
.select("vendor_key, status, confirmed_at, origin, cycle")
```

- [ ] After the `detectSubscriptions` call and before `withConfirmationStatus`, build and merge manual candidates:

```ts
import {
  buildManualCandidates,
  mergeSubscriptionCandidates,
  type ManualSubscriptionRow,
} from "@/lib/subscriptions"

// ... inside the component, after detectSubscriptions(recentInvoices):

const manualRows: ManualSubscriptionRow[] = (confirmationRows ?? [])
  .filter((row) => row.origin === "manual")
  .map((row) => ({
    vendor_key: row.vendor_key,
    cycle: row.cycle ?? "monthly",
    status: row.status,
  }))

const manualCandidates = buildManualCandidates(recentInvoices, manualRows)
const allCandidates = mergeSubscriptionCandidates(
  detectSubscriptions(recentInvoices),
  manualCandidates,
)

const subscriptions = withConfirmationStatus(allCandidates, confirmations)
```

- [ ] Run `npx tsc --noEmit`
- [ ] Commit

---

### Task 7: Docs + Verification

**Files:**
- Modify: `docs/subscription-reminders.md`

- [ ] Update `docs/subscription-reminders.md`:
  - Add a "Manual mark" section after "Confirmation state layers on top"
  - Remove "Manual mark as subscription override" from "Out of scope (v1)"

```markdown
## Manual mark

Users can manually mark a vendor as a monthly or yearly subscription from the vendor
detail Sheet when the auto-detector doesn't pick it up (e.g. only 1 invoice, or
irregular gaps). The mark persists an `origin=manual` row in
`subscription_confirmations` with the chosen `cycle`, and synthetic candidates are
merged into the detection pipeline alongside auto-detected ones — manual overrides
auto-detect for the same vendor.

Eligibility: vendor must have at least one invoice with an `issue_date`. The latest
invoice is used to derive `lastAmount`, `lastIssueDate`, and `nextExpectedDate`.
```

- [ ] Run full verification:
  - `npm run test`
  - `npx tsc --noEmit`
  - `npm run build`

- [ ] Commit
