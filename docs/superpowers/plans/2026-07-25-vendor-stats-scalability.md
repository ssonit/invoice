# Vendor Stats & Subscription Detection Scalability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/dashboard/vendors`'s unbounded `SELECT * FROM invoices` (grows forever with a user's invoice count) with two bounded SQL views — an exact aggregate for totals, and a per-vendor windowed set for subscription detection — plus move the vendor detail Sheet's full invoice history to on-demand lazy loading.

**Architecture:** A generated `invoices.vendor_key` column lets Postgres do the vendor-grouping work it's already good at. `vendor_invoice_stats` (GROUP BY) replaces JS-side total/count/last-date reduction. `vendor_recent_invoices` (windowed, ≤6/vendor) replaces the full invoice array as `detectSubscriptions()`'s input — that pure function itself doesn't change. The vendor detail Sheet fetches a vendor's full invoice list on demand instead of every vendor's full history being fetched eagerly on every page load.

**Tech Stack:** PostgreSQL (generated columns, views, window functions), Supabase, Next.js 16, React 19.

**Design spec:** `docs/superpowers/specs/2026-07-25-vendor-stats-scalability-design.md`

**Sequencing:** implement this plan before `docs/superpowers/plans/2026-07-25-vendors-pagination.md` (not yet implemented) — see that design spec's "Sequencing" note.

---

## Task 1: Migration — `vendor_key` column + the two views

**Files:**
- Create: `supabase/migrations/20260725140000_vendor_stats_views.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Generated, stored, indexed vendor-normalization column — Postgres computes
-- and backfills it automatically, and keeps it in sync forever (no separate
-- backfill step, unlike vendors.name_key which is a manually-maintained
-- column on a different table).
alter table public.invoices
  add column vendor_key text generated always as (
    case when vendor is null then null
    else lower(regexp_replace(trim(vendor), '\s+', ' ', 'g'))
    end
  ) stored;

create index invoices_user_vendor_key_idx on public.invoices (user_id, vendor_key);

-- One row per vendor with exact totals, computed by Postgres regardless of
-- how many underlying invoice rows exist — replaces JS-side reduction over
-- every invoice on every /dashboard/vendors load.
create view public.vendor_invoice_stats
with (security_invoker = true) as
with agg as (
  select user_id, vendor_key, sum(amount) as total, count(*) as count, max(issue_date) as last_date
  from public.invoices
  where vendor_key is not null
  group by user_id, vendor_key
),
latest as (
  select distinct on (user_id, vendor_key) user_id, vendor_key, vendor as label, currency
  from public.invoices
  where vendor_key is not null
  order by user_id, vendor_key, created_at desc
)
select agg.user_id, agg.vendor_key, latest.label, latest.currency, agg.total, agg.count, agg.last_date
from agg join latest using (user_id, vendor_key);

-- At most 6 most-recent (by issue_date) invoices per vendor — enough for
-- detectSubscriptions() to compute a reliable median gap without ever
-- fetching a vendor's full history.
create view public.vendor_recent_invoices
with (security_invoker = true) as
select * from (
  select
    invoices.*,
    row_number() over (
      partition by user_id, vendor_key
      order by issue_date desc nulls last, created_at desc
    ) as rn
  from public.invoices
  where vendor_key is not null and issue_date is not null
) ranked
where rn <= 6;

grant select on public.vendor_invoice_stats to authenticated, service_role;
grant select on public.vendor_recent_invoices to authenticated, service_role;
```

- [ ] **Step 2: Apply and verify**

Prerequisite: Docker Desktop running.

Run:
```bash
npx supabase db reset
```
Expected: reset completes cleanly (the `vendor_key` column backfills automatically for
existing seed rows during the `ALTER TABLE`).

Run:
```bash
npx supabase db query "select vendor, vendor_key from invoices where vendor is not null limit 5"
```
Expected: `vendor_key` populated (lowercase, trimmed) for every row.

Run:
```bash
npx supabase db query "select * from vendor_invoice_stats where user_id = '00000000-0000-0000-0000-000000000001' order by total desc limit 5"
```
Expected: one row per distinct vendor for the seeded admin, with `total`/`count`/`last_date` matching what you'd compute by hand from `supabase/seed.sql`'s invoice rows.

Run:
```bash
npx supabase db query "select vendor_key, count(*) from vendor_recent_invoices where user_id = '00000000-0000-0000-0000-000000000001' group by vendor_key having count(*) > 6"
```
Expected: zero rows (confirms the `rn <= 6` cap holds per vendor).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260725140000_vendor_stats_views.sql
git commit -m "feat: add vendor_key column and vendor_invoice_stats/vendor_recent_invoices views"
```

---

## Task 2: Rewrite `page.tsx`'s data-fetching to use the two views

The JSX, `CycleBadge`, `matchesFilter`, and `sortVendors` are unchanged — only the
data-fetching and merge section (from the `Promise.all` through building `vendorMap`)
changes.

**Files:**
- Modify: `src/app/dashboard/vendors/page.tsx`

- [ ] **Step 1: Replace the data-fetching + merge section**

Change:
```tsx
  const [{ data: vendorRowsInitial }, { data: invoiceRows }, { data: confirmationRows }] =
    await Promise.all([
      vendorsQuery,
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

  // When searching, skip orphan heal (orphans wouldn't match the filtered query anyway
  // until upserted). Still heal when browsing the full list.
  let vendorRows = vendorRowsInitial
  if (!query.q) {
    const existingKeys = new Set((vendorRowsInitial ?? []).map((row) => row.name_key))
    const orphanUpserts: {
      user_id: string
      name: string
      name_key: string
      updated_at: string
    }[] = []
    const seenKeys = new Set<string>()
    const now = new Date().toISOString()
    for (const invoice of invoices) {
      if (!invoice.vendor) continue
      const key = normalizeVendorKey(invoice.vendor)
      if (existingKeys.has(key) || seenKeys.has(key)) continue
      seenKeys.add(key)
      orphanUpserts.push({
        user_id: user!.id,
        name: invoice.vendor.trim(),
        name_key: key,
        updated_at: now,
      })
    }
    if (orphanUpserts.length > 0) {
      await supabase.from("vendors").upsert(orphanUpserts, {
        onConflict: "user_id,name_key",
        ignoreDuplicates: true,
      })
      const refreshed = await supabase
        .from("vendors")
        .select("id, name, name_key, notes, created_at")
        .eq("user_id", user!.id)
        .order("name", { ascending: true })
      vendorRows = refreshed.data
    }
  }

  const confirmations = new Map<string, SubscriptionConfirmation>(
    (confirmationRows ?? []).map((row) => [
      row.vendor_key,
      { status: row.status as "active" | "cancelled", confirmedAt: row.confirmed_at },
    ]),
  )

  const subscriptions = withConfirmationStatus(detectSubscriptions(invoices), confirmations)
  const due = subscriptions.filter((s) => s.needsConfirmation)

  const invoiceByKey = new Map<
    string,
    {
      total: number
      currency: string | null
      count: number
      lastDate: string
      invoices: VendorListItem["invoices"]
      label: string
    }
  >()

  for (const invoice of invoices) {
    if (!invoice.vendor) continue
    const key = normalizeVendorKey(invoice.vendor)
    const existing = invoiceByKey.get(key)
    if (existing) {
      existing.total += invoice.amount ?? 0
      existing.count += 1
      if (invoice.issue_date && invoice.issue_date > existing.lastDate) {
        existing.lastDate = invoice.issue_date
      }
      existing.invoices.push({
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        amount: invoice.amount,
        currency: invoice.currency,
        issue_date: invoice.issue_date,
        due_date: invoice.due_date,
      })
    } else {
      invoiceByKey.set(key, {
        label: invoice.vendor,
        total: invoice.amount ?? 0,
        currency: invoice.currency,
        count: 1,
        lastDate: invoice.issue_date ?? "",
        invoices: [
          {
            id: invoice.id,
            invoice_number: invoice.invoice_number,
            amount: invoice.amount,
            currency: invoice.currency,
            issue_date: invoice.issue_date,
            due_date: invoice.due_date,
          },
        ],
      })
    }
  }

  const vendorMap = new Map<string, VendorListItem>()

  for (const row of vendorRows ?? []) {
    const stats = invoiceByKey.get(row.name_key)
    vendorMap.set(row.name_key, {
      id: row.id,
      key: row.name_key,
      label: row.name,
      notes: row.notes,
      createdAt: row.created_at,
      total: stats?.total ?? 0,
      currency: stats?.currency ?? null,
      count: stats?.count ?? 0,
      lastDate: stats?.lastDate ?? "",
      subscription: null,
      invoices: stats?.invoices ?? [],
    })
  }
```
to:
```tsx
  const [
    { data: vendorRowsInitial },
    { data: statsRows },
    { data: recentRows },
    { data: confirmationRows },
  ] = await Promise.all([
    vendorsQuery,
    supabase.from("vendor_invoice_stats").select("*").eq("user_id", user!.id),
    supabase.from("vendor_recent_invoices").select("*").eq("user_id", user!.id),
    supabase
      .from("subscription_confirmations")
      .select("vendor_key, status, confirmed_at")
      .eq("user_id", user!.id),
  ])

  const stats = statsRows ?? []
  // vendor_recent_invoices selects invoices.* (plus rn), so each row has the
  // same shape/coercion needs as a raw invoices row.
  const recentInvoices = (recentRows ?? []).map(normalizeInvoice)

  // When searching, skip orphan heal (orphans wouldn't match the filtered query anyway
  // until upserted). Still heal when browsing the full list. Sourced from the small
  // aggregate view (one row per distinct vendor) instead of the full invoice history.
  let vendorRows = vendorRowsInitial
  if (!query.q) {
    const existingKeys = new Set((vendorRowsInitial ?? []).map((row) => row.name_key))
    const now = new Date().toISOString()
    const orphanUpserts = stats
      .filter((row) => !existingKeys.has(row.vendor_key))
      .map((row) => ({
        user_id: user!.id,
        name: row.label.trim(),
        name_key: row.vendor_key,
        updated_at: now,
      }))
    if (orphanUpserts.length > 0) {
      await supabase.from("vendors").upsert(orphanUpserts, {
        onConflict: "user_id,name_key",
        ignoreDuplicates: true,
      })
      const refreshed = await supabase
        .from("vendors")
        .select("id, name, name_key, notes, created_at")
        .eq("user_id", user!.id)
        .order("name", { ascending: true })
      vendorRows = refreshed.data
    }
  }

  const confirmations = new Map<string, SubscriptionConfirmation>(
    (confirmationRows ?? []).map((row) => [
      row.vendor_key,
      { status: row.status as "active" | "cancelled", confirmedAt: row.confirmed_at },
    ]),
  )

  const subscriptions = withConfirmationStatus(
    detectSubscriptions(recentInvoices),
    confirmations,
  )
  const due = subscriptions.filter((s) => s.needsConfirmation)

  const statsByKey = new Map(stats.map((row) => [row.vendor_key, row]))

  const recentByKey = new Map<string, VendorListItem["invoices"]>()
  for (const invoice of recentInvoices) {
    if (!invoice.vendor) continue
    const key = normalizeVendorKey(invoice.vendor)
    const list = recentByKey.get(key) ?? []
    list.push({
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      amount: invoice.amount,
      currency: invoice.currency,
      issue_date: invoice.issue_date,
      due_date: invoice.due_date,
    })
    recentByKey.set(key, list)
  }

  const vendorMap = new Map<string, VendorListItem>()

  for (const row of vendorRows ?? []) {
    const stat = statsByKey.get(row.name_key)
    vendorMap.set(row.name_key, {
      id: row.id,
      key: row.name_key,
      label: row.name,
      notes: row.notes,
      createdAt: row.created_at,
      // sum()/count() come back from PostgREST as numeric strings — coerce,
      // same reason normalizeInvoice() coerces amount/tax/confidence_score.
      total: stat ? Number(stat.total) : 0,
      currency: stat?.currency ?? null,
      count: stat ? Number(stat.count) : 0,
      lastDate: stat?.last_date ?? "",
      subscription: null,
      // Windowed (≤6) invoices for immediate display — VendorsList lazy-loads
      // the full per-vendor history when a vendor's detail Sheet is opened.
      invoices: recentByKey.get(row.name_key) ?? [],
    })
  }
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (`normalizeVendorKey` stays imported and used; the only import that
becomes unused is nothing — every existing import is still referenced.)

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/vendors/page.tsx
git commit -m "feat: query vendor_invoice_stats and vendor_recent_invoices instead of all invoices"
```

---

## Task 3: Simplify `updateVendor`/`deleteVendor`, add `getVendorInvoices`

**Files:**
- Modify: `src/app/dashboard/vendors/actions.ts`

- [ ] **Step 1: Simplify the invoice-rename block in `updateVendor`**

Change:
```ts
  if (oldKey !== newKey) {
    const { data: invoices } = await service
      .from("invoices")
      .select("id, vendor")
      .eq("user_id", user.id)
      .not("vendor", "is", null);

    const toRename = (invoices ?? []).filter(
      (row) => row.vendor && normalizeVendorKey(row.vendor) === oldKey,
    );

    if (toRename.length > 0) {
      await Promise.all(
        toRename.map((row) =>
          service
            .from("invoices")
            .update({ vendor: parsed.data.name })
            .eq("id", row.id)
            .eq("user_id", user.id),
        ),
      );
    }

    await service
      .from("subscription_confirmations")
      .update({ vendor_key: newKey })
      .eq("user_id", user.id)
      .eq("vendor_key", oldKey);
  }
```
to:
```ts
  if (oldKey !== newKey) {
    // vendor_key is a generated column — updating `vendor` recomputes it
    // automatically, so this single bulk update replaces the old
    // fetch-all-then-filter-then-update-one-by-one pattern.
    await service
      .from("invoices")
      .update({ vendor: parsed.data.name })
      .eq("user_id", user.id)
      .eq("vendor_key", oldKey);

    await service
      .from("subscription_confirmations")
      .update({ vendor_key: newKey })
      .eq("user_id", user.id)
      .eq("vendor_key", oldKey);
  }
```

- [ ] **Step 2: Simplify the invoice-unlink block in `deleteVendor`**

Change:
```ts
  const { data: invoices } = await service
    .from("invoices")
    .select("id, vendor")
    .eq("user_id", user.id)
    .not("vendor", "is", null);

  const linked = (invoices ?? []).filter(
    (row) => row.vendor && normalizeVendorKey(row.vendor) === nameKey,
  );

  if (linked.length > 0) {
    await Promise.all(
      linked.map((row) =>
        service
          .from("invoices")
          .update({ vendor: null })
          .eq("id", row.id)
          .eq("user_id", user.id),
      ),
    );
  }
```
to:
```ts
  await service
    .from("invoices")
    .update({ vendor: null })
    .eq("user_id", user.id)
    .eq("vendor_key", nameKey);
```

- [ ] **Step 3: Add `getVendorInvoices`**

Append to the end of the file:
```ts
export type GetVendorInvoicesResult =
  | { ok: true; invoices: VendorListInvoice[] }
  | { ok: false; error: string };

// On-demand fetch for the vendor detail Sheet's full invoice history — the
// page-level query only ever loads a bounded, windowed sample per vendor
// (see vendor_recent_invoices), so the full list is fetched only when a
// user actually opens a vendor's detail view.
export async function getVendorInvoices(vendorKey: string): Promise<GetVendorInvoicesResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, amount, currency, issue_date, due_date")
    .eq("user_id", user.id)
    .eq("vendor_key", vendorKey)
    .order("issue_date", { ascending: false });

  if (error) {
    console.error("Failed to load vendor invoices", user.id, vendorKey, error);
    return { ok: false, error: "Could not load invoices. Please try again." };
  }

  return { ok: true, invoices: data ?? [] };
}
```
Add the `VendorListInvoice` type import alongside the existing imports at the top of the
file:
```ts
import type { VendorListInvoice } from "@/components/dashboard/vendors/vendors-list";
```

This uses the RLS-scoped client (`createClient()`), not the service-role client — a user
reading their own invoices is already permitted by the existing `invoices` RLS policy, no
privilege escalation needed (unlike the mutation actions above, which use the service
client after an explicit auth check, matching the established pattern for writes).

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/vendors/actions.ts
git commit -m "feat: simplify vendor rename/delete via vendor_key, add getVendorInvoices"
```

---

## Task 4: Lazy-load full invoice history in `VendorsList`'s detail Sheet

**Files:**
- Modify: `src/components/dashboard/vendors/vendors-list.tsx`

- [ ] **Step 1: Import the new action and add loading state**

Change:
```tsx
import { deleteVendor } from "@/app/dashboard/vendors/actions"
```
to:
```tsx
import { deleteVendor, getVendorInvoices } from "@/app/dashboard/vendors/actions"
```

Change:
```tsx
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, startDelete] = useTransition()
```
to:
```tsx
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [fullInvoices, setFullInvoices] = useState<VendorListInvoice[] | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, startDelete] = useTransition()
  const [isLoadingInvoices, startLoadInvoices] = useTransition()

  // Triggered directly from the row click (not an Effect) — this responds to
  // a discrete user action, not something to "synchronize" on every render.
  function selectVendor(key: string) {
    setSelectedKey(key)
    setFullInvoices(null)
    startLoadInvoices(async () => {
      const result = await getVendorInvoices(key)
      if (result.ok) setFullInvoices(result.invoices)
    })
  }
```

- [ ] **Step 2: Wire the row click to the new function**

Change:
```tsx
                onClick={() => setSelectedKey(vendor.key)}
```
to:
```tsx
                onClick={() => selectVendor(vendor.key)}
```

- [ ] **Step 3: Show the full list once loaded, windowed list until then**

Change:
```tsx
                <div>
                  <p className="mb-2 text-sm font-medium">Invoices</p>
                  {selected.invoices.length === 0 ? (
                    <p className="rounded-lg border border-border px-3 py-3 text-xs text-muted-foreground">
                      No invoices linked yet.
                    </p>
                  ) : (
                    <ul className="rounded-lg border border-border">
                      {selected.invoices.map((invoice, index) => (
```
to:
```tsx
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <p className="text-sm font-medium">Invoices</p>
                    {isLoadingInvoices ? (
                      <Spinner className="size-3.5 text-muted-foreground" />
                    ) : null}
                  </div>
                  {(fullInvoices ?? selected.invoices).length === 0 ? (
                    <p className="rounded-lg border border-border px-3 py-3 text-xs text-muted-foreground">
                      No invoices linked yet.
                    </p>
                  ) : (
                    <ul className="rounded-lg border border-border">
                      {(fullInvoices ?? selected.invoices).map((invoice, index) => (
```
(The closing `))}`/`</ul>` etc. below are unchanged — only the two references to
`selected.invoices` in this block become `(fullInvoices ?? selected.invoices)`.)

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint src/components/dashboard/vendors/vendors-list.tsx src/app/dashboard/vendors/actions.ts src/app/dashboard/vendors/page.tsx`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/vendors/vendors-list.tsx
git commit -m "feat: lazy-load full vendor invoice history in the detail Sheet"
```

---

## Task 5: Full verification + docs

**Files:**
- Create: `docs/vendor-stats-scalability.md`

- [ ] **Step 1: Run the whole test suite**

Run: `npm run test`
Expected: all suites pass unchanged — `detectSubscriptions()` (`src/lib/subscriptions.ts`)
was not modified, so its existing 17-test suite still passes without edits.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Manual smoke test**

Prerequisite: local Supabase + dev server running, logged in as the seeded admin.

1. Open `/dashboard/vendors` → vendor totals/counts/last-dates match what they were
   before this change (spot-check 2-3 vendors against `supabase/seed.sql`).
2. Insert a synthetic vendor with >6 invoices spaced ~30 days apart via `npx supabase db
   query` (mirror the pattern from the subscription-reminders feature's smoke test) →
   confirm it still shows up correctly in "Needs your confirmation" if due, and its total/
   count reflect *all* its invoices, not just the most recent 6.
3. Click into that vendor's detail Sheet → initially shows up to 6 invoices (from the
   windowed set), then within a moment swaps to the full list (watch for the small
   loading spinner next to "Invoices") — confirm the full list actually has more than 6
   entries once loaded.
4. Rename a vendor (Edit) → confirm linked invoices' vendor name updates (spot-check via
   `npx supabase db query "select vendor, vendor_key from invoices where ..."`) and the
   `vendor_key` recomputed automatically to match the new name.
5. Delete a vendor with linked invoices → confirm those invoices' `vendor` becomes null
   (spot-check via SQL) rather than the vendor disappearing silently.
6. Clean up any synthetic data inserted for this test.

- [ ] **Step 4: Write `docs/vendor-stats-scalability.md`**

Record: the original unbounded-fetch problem, the two-view solution (exact SQL
aggregation for totals, windowed per-vendor sample for subscription detection),
why `detectSubscriptions()` itself needed no changes, the `vendor_key` generated column
and how it also simplified `updateVendor`/`deleteVendor`, and the detail Sheet's
on-demand full-history load. Link the design spec.

- [ ] **Step 5: Final commit**

```bash
git add docs/vendor-stats-scalability.md
git commit -m "docs: record vendor stats scalability rearchitecture"
```

---

## File Structure Summary

**Created:**
- `supabase/migrations/20260725140000_vendor_stats_views.sql`
- `docs/vendor-stats-scalability.md`

**Modified:**
- `src/app/dashboard/vendors/page.tsx`
- `src/app/dashboard/vendors/actions.ts`
- `src/components/dashboard/vendors/vendors-list.tsx`
