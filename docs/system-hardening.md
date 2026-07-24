# System Hardening

**Date:** 2026-07-23
**Design spec:** [`docs/superpowers/specs/2026-07-23-system-hardening-design.md`](superpowers/specs/2026-07-23-system-hardening-design.md)
**Plan:** [`docs/superpowers/plans/2026-07-23-system-hardening.md`](superpowers/plans/2026-07-23-system-hardening.md)

Four scoped gaps closed from a codebase audit: password recovery, upload dedup, invoices
pagination/filtering, and account settings.

## Password recovery

`/forgot-password` → `supabase.auth.resetPasswordForEmail()` → emailed link →
`/auth/callback` (new Route Handler, `exchangeCodeForSession`) → `/reset-password` →
`supabase.auth.updateUser({ password })`. The forgot-password form always shows the same
"check your inbox" state regardless of whether the email is registered, to avoid account
enumeration.

**Local dev gotcha found during verification:** `supabase/config.toml`'s
`additional_redirect_urls` only allowed two exact URLs. Supabase Auth's redirect
validation checks the *full* URL including query string, so
`http://localhost:3000/auth/callback?next=/reset-password` didn't match an exact-path
entry — the reset link silently fell back to the bare `site_url`, with no visible error.
Fixed by switching to wildcard entries (`http://localhost:3000/**`,
`http://127.0.0.1:3000/**`) and restarting the local stack (`supabase stop && supabase
start` — `db reset` alone does not reload `config.toml`).

## Upload dedup

`POST /api/invoices/upload` computes `sha256Hex(buffer)` (`src/lib/file-hash.ts`) before
calling `extractInvoice()`. A `(user_id, content_hash)` match short-circuits the request
and returns the existing invoice — no LLM call spent on an exact re-upload. On a miss, the
row is saved via `.upsert(..., { onConflict: "user_id,content_hash" })` rather than
`.insert()`, so a race between two concurrent uploads of the same file can't create a
duplicate row either. `content_hash` is only ever set for `source = 'upload'` rows — the
email path already dedupes independently via `source_ref`/`source_message_id`.

## Invoices page: pagination + server-side filtering

Scoped to `/dashboard/invoices` only — Overview, Vendors, and Inbox all need the complete
invoice history to compute stats/trend/subscription-detection and are not paginated.
`src/lib/pagination.ts` (offset/page-count math) and `src/lib/invoices/query.ts`
(page/vendor/status URL-param parsing) are pure and unit-tested; the page itself builds a
Supabase query with `.range()` + `.ilike()` + `.eq("needs_review", ...)` driven by those
parsed params.

Filtering was moved server-side (originally scoped as pagination-only) after discovering
during design review that the existing `InvoicesTable` filtered client-side over the
*entire* loaded dataset — pagination alone would have silently broken vendor/status search
to only match the current page's rows. Column *sort* (Amount / Issue date header click)
intentionally stays client-side, scoped to the current page — an accepted, smaller
regression versus rewriting sort as a server-side query param too.

## Account settings

`/dashboard/settings` gained two cards:

- **Change password** — reuses `resetPasswordSchema`/`parseResetPasswordForm` from the
  password-recovery work (same shape, no duplication).
- **Delete account — soft delete, no data removed.** Per explicit instruction, account
  deletion never physically removes anything. `deleteAccount()` sets
  `profiles.deleted_at` and signs the user out; `invoices`, `vendors`, `inboxes`, and the
  `auth.users` row are all left untouched. `src/app/login/actions.ts` checks
  `profiles.deleted_at` after a successful `signInWithPassword` and rejects the session
  with "This account has been deleted." if set — checked only at login (not on every
  request via the session middleware), so an already-open session on another device stays
  valid until its token naturally expires. No self-service reactivation exists; restoring
  an account is a manual `update profiles set deleted_at = null` for now.

## Verification

`npm run test` (16 files / 149 tests), `npx tsc --noEmit`, and `npm run build` all clean.
Manually verified end-to-end in-browser: full password-recovery round trip via the local
Mailpit mail UI (including a real login with the new password from a clean session);
pagination (35 synthetic + real rows → correct page counts and page-2 contents) and both
filters (vendor search, status) returning server-correct result sets; upload dedup's
core guarantee (`upsert` on `(user_id, content_hash)` never produces a second row)
verified directly against Postgres; and the full soft-delete lifecycle — signup a
throwaway account, delete it, confirm `deleted_at` is set while `profiles` and
`auth.users` rows remain, then confirm a login attempt is rejected with the correct
message. All synthetic/test data was cleaned up afterward.
