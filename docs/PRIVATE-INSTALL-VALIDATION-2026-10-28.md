# Private-install preparation — 2026-10-28

Scope: prepare the existing product for a separately deployed small-business
installation, with one responsible operator per account. No billing platform,
shared team workspace or new database migration was added.

## Changes

- Only an explicit `approved_at` grants the Approved badge. Model confidence is
  no longer approval. Inbox status filters now agree with the badges, including
  manually approved invoices with low confidence.
- Re-reading creates an in-memory proposal. Saved fields, original extraction
  metadata and approval remain unchanged until Save. The form shows saved values
  for comparison; Line Items shows the proposal and expandable saved items.
- Saving edits or a reviewed proposal clears approval and requires review again.
  Ordinary edits omit `line_items`, preserving existing items. Reviewed proposal
  line items are validated server-side and saved only on explicit Save.
- Preview extraction uses the upload rate limiter when Redis is configured.
  Preview metrics are logged rather than replacing the saved invoice's initial
  extraction metrics. Cancelled previews still incur provider usage.
- The Document area previously displayed a reconstruction from extracted values.
  It now embeds the original PDF/image, with working download/open controls.
  The file route verifies the current user and invoice ownership, excludes
  deleted invoices, and only then reads the private storage bucket using the
  service client. Responses are private/no-store, use supported MIME types and
  do not expose storage paths or keys.
- Empty Overview includes upload → check/approve → export guidance in EN/VI.
  The forwarding link is omitted when email intake is not configured.
- Added Vietnamese offer/demo/install guidance and a blank customer acceptance
  template. Prices and customer-specific commitments remain explicit placeholders.
- ESLint excludes `.e2e/`, matching its existing Git ignore rule for generated
  runner output and local audit scripts. Source and checked-in tests remain linted.

## Validation

- Vitest: 474 passing tests in 49 files.
- ESLint, TypeScript and the production Next.js build pass.
- Production-app Chrome smoke: login renders, signed-out Dashboard redirects to
  login, and the original-file API returns 401 when signed out. No uncaught
  browser errors in this smoke pass.
- New behavioral tests exercise actual Supabase query builders with simulated
  HTTP responses: preview without writes, explicit saves and approvals, ownership,
  soft-deleted invoices, rate limiting, Inbox filter/badge parity, and private file
  bytes/headers/access failures.
- Headless Chrome component smoke checks: approval remains available at high
  confidence; preview, saved value comparison, saved/new line items, Cancel,
  edited Save, download target, Vietnamese preview, mobile onboarding at 390px
  without horizontal overflow, and email onboarding visibility. No uncaught
  browser errors. These mount real React components with mocked Next router,
  Server Actions and file endpoint; they are not authenticated full-app E2E tests.

## Remaining acceptance work

The local Supabase API was not listening on port 54321 during this pass.
Authenticated full-app flows against a real database, real extraction calls,
production storage/PDF viewing, email delivery, and AgentMail/Trigger execution
must be verified on the customer's installation before signing acceptance.

Do not treat this preparation record as a completed customer acceptance report.
Use `PRIVATE-INSTALL-ACCEPTANCE-VI.md` with actual customer evidence.
