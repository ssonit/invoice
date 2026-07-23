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
4. No account-management page — no way to change password or delete an account (and its
   AgentMail inbox) without touching the database directly.

## Scope decisions

| Item | Decision |
|---|---|
| Password recovery | Full flow: `/forgot-password`, `/auth/callback` (PKCE code exchange — doesn't exist yet), `/reset-password`. |
| Upload dedup | Content-hash based (SHA-256 of the raw file buffer), not filename-based — catches exact re-uploads regardless of filename, and lets the route skip the LLM call entirely on a hash hit (cost savings, not just correctness). |
| Pagination | **`/dashboard/invoices` only.** Overview (stats/trend) and Vendors (`detectSubscriptions` needs the full history to compute median billing-cycle gaps) require the complete dataset and are explicitly out of scope — paginating them would require rewriting stat computation as SQL aggregates, a separate, larger effort. Inbox page also stays unpaginated for this round (kept in sync with Overview/Vendors rather than diverging). |
| Account deletion | Deletes the AgentMail inbox first (`agentmail.inboxes.delete`), then the Supabase auth user (`auth.admin.deleteUser`) — existing `on delete cascade` FKs handle `invoices`/`vendors`/`subscription_confirmations`/`inboxes` rows. Requires the user to type their email to confirm (irreversible, no soft-delete in v1). |

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

`src/app/dashboard/invoices/page.tsx` currently does one unbounded
`.from("invoices").select("*").eq("user_id", ...)`. Change to:

```ts
const page = Number(searchParams.page ?? "1");
const pageSize = 20;
const from = (page - 1) * pageSize;
const to = from + pageSize - 1;

const { data, count } = await supabase
  .from("invoices")
  .select("*", { count: "exact" })
  .eq("user_id", user!.id)
  .order("created_at", { ascending: false })
  .range(from, to);
```

`src/components/dashboard/invoices-table.tsx` switches from client-side pagination
(`getPaginationRowModel`) to server-driven: `manualPagination: true`, `pageCount` derived
from `count`/`pageSize`, and the existing "Page X of Y" controls become links/buttons that
navigate to `?page=N` (Server Component re-fetches on navigation — no client state needed
for the page number itself). Column sort/filter inside the currently-loaded page stays
client-side as today; sorting the *entire* dataset server-side is out of scope for this
round (would need to push `sort`/`filter` into the query too — noted as a natural
follow-up, not built now).

## 4. Account settings

Extends `/dashboard/settings` (currently just the forwarding-address card) with two new
cards:

- **Change password:** client form → `supabase.auth.updateUser({ password })` directly
  (the user already has a valid session; Supabase doesn't require re-entering the old
  password for this call).
- **Delete account:** requires typing the account's own email into a confirmation input
  before the button enables (mirrors common "type to confirm" destructive-action pattern).
  Server Action:
  1. Re-check the typed email matches `session.user.email` server-side (never trust the
     client-side enable/disable check alone).
  2. Look up the user's `inboxes` row; if present, `agentmail.inboxes.delete(agentmail_inbox_id)`.
  3. `createServiceClient().auth.admin.deleteUser(user.id)` — cascades through existing FKs.
  4. Sign out / clear the session, redirect to `/`.

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
- Soft-delete / account recovery window for account deletion — deletion is immediate and
  irreversible in v1.
- Rate-limiting the forgot-password or upload endpoints (worth revisiting before real
  public launch, not necessary pre-launch).
