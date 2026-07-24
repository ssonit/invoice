# System Hardening — Password Recovery, Upload Dedup, Invoices Pagination, Account Settings

**Date:** 2026-07-23
**Status:** Approved for implementation

## Goal

Close four concrete gaps found in a codebase audit of the current system, prioritized by
necessity over polish (no customers yet, so scope stays tight):

1. No self-service password recovery — a locked-out user has no way back in.
2. Manual file uploads aren't deduplicated — re-uploading the same file (double-click,
   retry) creates a duplicate invoice row. The email path already solved this
   (`source_ref` + upsert, see `docs/webhook-task-queue.md`); uploads never got the same
   treatment.
3. Every dashboard page fetches a user's entire invoice history on every load, with no
   database-level pagination. Fine today; won't scale.
4. No account-management page — no way to change password or deactivate an account
   without touching the database directly.

## Scope decisions

| Item | Decision |
|---|---|
| Password recovery | Full flow: `/forgot-password`, `/auth/callback` (PKCE code exchange — doesn't exist yet), `/reset-password`. |
| Upload dedup | Content-hash based (SHA-256 of the raw file buffer), not filename-based — catches exact re-uploads regardless of filename, and lets the route skip the LLM call entirely on a hash hit (cost savings, not just correctness). |
| Pagination | **`/dashboard/invoices` only.** Overview (stats/trend) and Vendors (`detectSubscriptions` needs the full history to compute median billing-cycle gaps) require the complete dataset and are explicitly out of scope — paginating them would require rewriting stat computation as SQL aggregates, a separate, larger effort. Inbox page also stays unpaginated for this round (kept in sync with Overview/Vendors rather than diverging). |
| Account deletion | **Revised — no data deletion allowed.** Soft delete only: sets `profiles.deleted_at`, blocks future login, signs out the current session. No row is physically removed (not `invoices`, `vendors`, `inboxes`, nor the `auth.users` row itself), and the AgentMail inbox is left untouched. Requires the user to type their email to confirm. |

## 1. Password recovery

```
/login → "Forgot password?" link
   ▼
/forgot-password (form: email)
   │  supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback?next=/reset-password` })
   ▼ (email sent, regardless of whether the address exists — no account enumeration)
user clicks the link in their email
   ▼
/auth/callback?code=...&next=/reset-password  (new Route Handler)
   │  supabase.auth.exchangeCodeForSession(code)
   ▼ redirect to `next`
/reset-password (form: new password)
   │  supabase.auth.updateUser({ password })
   ▼ redirect to /dashboard
```

`src/lib/supabase/update-session.ts` currently redirects any unauthenticated request under
`/dashboard` to `/login`, and only allowlists `/login`/`/signup` as auth routes. Add
`/forgot-password`, `/reset-password`, and `/auth/callback` to that allowlist so the
recovery flow itself doesn't get redirected away mid-flow.

The forgot-password form always shows the same success message regardless of whether the
email matches an account — standard practice to avoid leaking which emails are registered.

## 2. Upload dedup (content hash)

New migration. Same pattern as `invoices_source_message_ref_key` from the webhook
task-queue feature: `supabase-js` `.upsert({...}, { onConflict: "..." })` generates
`ON CONFLICT (...)` with **no `WHERE` clause**, so the conflict target must be a
non-partial unique constraint, not a partial unique index:

```sql
alter table public.invoices add column content_hash text;

alter table public.invoices
  add constraint invoices_user_content_hash_key
  unique (user_id, content_hash);
```

`content_hash` is only ever set for `source = 'upload'` rows (email rows already dedupe via
`source_ref` and leave `content_hash` null). NULLs are distinct in a unique constraint, so
the many `content_hash IS NULL` rows (every email-sourced invoice) never collide with each
other. `POST /api/invoices/upload` (`src/app/api/invoices/upload/route.ts`):

1. Read the file into a buffer (already happens today).
2. Compute `sha256(buffer)` (Node's built-in `crypto`, no new dependency).
3. Query `invoices` for an existing `(user_id, content_hash)` match.
   - **Hit:** return the existing invoice immediately. No LLM call, no new row.
   - **Miss:** proceed exactly as today (`extractInvoice`, storage upload), then upsert
     the row with `content_hash` set, using `onConflict: "user_id,content_hash"` as a
     defense against a concurrent duplicate request racing the initial existence check.

## 3. Invoices page pagination

**Revised during design review:** the existing `InvoicesTable` has a vendor-search input
and a status filter (`columns.tsx`: `needs_review ? "review" : "ok"`) that today filter
across the *entire* loaded dataset client-side (`getFilteredRowModel`). Pagination alone
would silently break them — a vendor search would only match invoices on the currently
viewed page. So **filtering moves server-side along with pagination**; only column
*sorting* (Amount / Issue date header click) stays client-side, scoped to the current
page's 20 rows — a smaller, accepted regression (unchanged from the original decision).

`src/app/dashboard/invoices/page.tsx` currently does one unbounded
`.from("invoices").select("*").eq("user_id", ...)`. Change to read `page`, `vendor`,
`status` from `searchParams` and build the query accordingly:

```ts
const page = Number(searchParams.page ?? "1");
const pageSize = 20;
const from = (page - 1) * pageSize;
const to = from + pageSize - 1;

let query = supabase
  .from("invoices")
  .select("*", { count: "exact" })
  .eq("user_id", user!.id)
  .order("created_at", { ascending: false });

if (searchParams.vendor) {
  query = query.ilike("vendor", `%${escapeIlike(searchParams.vendor)}%`);
}
if (searchParams.status === "review") query = query.eq("needs_review", true);
if (searchParams.status === "ok") query = query.eq("needs_review", false);

const { data, count } = await query.range(from, to);
```

Reuses `escapeIlike` from `src/lib/vendors/query.ts` (already unit-tested) rather than
duplicating LIKE-escaping logic.

`src/components/dashboard/invoices-table.tsx` changes from fully client-driven to a hybrid:
- `manualPagination: true`, `manualFiltering: true`, `pageCount` derived from `count`/`pageSize`.
- The vendor input and status buttons update the URL's `?vendor=`/`?status=` query params
  (via `useRouter().push`, matching the pattern already used by
  `src/lib/vendors/query.ts` consumers) instead of calling `table.getColumn(...).setFilterValue(...)`.
  Changing a filter resets `page` back to `1`.
- "Page X of Y" controls become links that navigate to `?page=N` (preserving the current
  `vendor`/`status` params) instead of calling `table.nextPage()`/`previousPage()`.
- Column *sort* (`getSortedRowModel`) is left as-is, operating on the current page's rows
  only — explicitly accepted, not fixed this round.

## 4. Account settings

Extends `/dashboard/settings` (currently just the forwarding-address card) with two new
cards:

- **Change password:** client form → `supabase.auth.updateUser({ password })` directly
  (the user already has a valid session; Supabase doesn't require re-entering the old
  password for this call).
- **Delete account (soft delete — no data is removed):** requires typing the account's own
  email into a confirmation input before the button enables (mirrors common "type to
  confirm" destructive-action pattern), same UX as originally planned. What happens
  underneath is different:

  New migration:
  ```sql
  alter table public.profiles add column deleted_at timestamptz;
  ```
  `profiles` already exists (one row per user, auto-created via the `handle_new_user`
  trigger, `service_role` already has `update` granted) — reused rather than adding a new
  table.

  Server Action:
  1. Re-check the typed email matches `session.user.email` server-side (never trust the
     client-side enable/disable check alone).
  2. `createServiceClient().from("profiles").update({ deleted_at: now }).eq("id", user.id)`.
     No `invoices`/`vendors`/`inboxes`/`auth.users` row is touched. The AgentMail inbox is
     left as-is — nothing in this app is authorized to delete it, and there's no AgentMail
     "pause" API to fall back to, so it stays active (noted as a known limitation, not
     fixed this round).
  3. Sign out the current session, redirect to `/`.

  Login must then honor `deleted_at`: `src/app/login/actions.ts`, after a successful
  `signInWithPassword`, checks `profiles.deleted_at` for the signed-in user; if set, signs
  them back out immediately and shows "This account has been deleted." instead of
  proceeding to `/dashboard`. This is checked only at login (not on every request via the
  session middleware) — cheap, and covers the actual risk (someone signing back in), at
  the cost of not instantly kicking out an *already-open* session on a second device the
  moment deletion happens (that session persists until its token naturally expires) —
  accepted for v1, called out explicitly rather than silently left as a gap.

  No self-service reactivation in v1 — a soft-deleted account stays locked out; restoring
  one is a manual `update profiles set deleted_at = null` for now.

## Testing

Following the established project convention (unit-test pure `lib/` logic, verify
routes/Server Actions/pages manually):

- New: a small `src/lib/file-hash.ts` (`sha256Hex(buffer): string`) wrapping Node's
  `crypto` — thin enough that a unit test mostly just pins the hash of a known input, but
  worth having since dedup correctness depends on it being deterministic.
- Pagination math (`from`/`to`/`pageCount` calculation) extracted into a small pure helper
  in `src/lib/pagination.ts` so the offset/page-count arithmetic is unit-tested rather than
  only exercised by clicking through the UI.
- `/forgot-password`, `/auth/callback`, `/reset-password`, upload-dedup end-to-end, and the
  account-settings page: manually verified via browser (Supabase auth emails can be
  inspected through the local Supabase Inbucket/mail testing UI in dev).

## Out of scope

- Paginating Overview, Vendors, or Inbox (would require rewriting stats/trend/subscription
  detection as SQL aggregates — separate effort).
- Server-side sort/filter for the Invoices table (only pagination this round).
- Self-service account reactivation after a soft delete (manual DB update only, for now).
- Deleting or pausing the AgentMail inbox on account deletion — no API for pausing exists,
  and outright deleting it would violate the no-data-deletion constraint anyway.
- Rate-limiting the forgot-password or upload endpoints (worth revisiting before real
  public launch, not necessary pre-launch).
