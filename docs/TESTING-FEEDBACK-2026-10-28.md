# Feature audit (2026-10-28)

Fixed:

- CSV export now pages through PostgREST instead of silently stopping at the
  server response limit. The 5,000-invoice product limit remains; an extra row
  is fetched to distinguish exactly 5,000 matches from a truncated export.
- Export date filtering now uses the invoice date, falling back to creation
  date only when invoice date is absent. Filtering happens before pagination,
  so recently uploaded old invoices cannot displace matching export rows.
- Analytics and Exports include the current month in their 6/12-month ranges.
  Previously the query included one month more than the chart buckets.
- Exports keeps its filters visible when there are zero matches, allowing users
  to recover by changing the range or status.
- Parallel uploads track outcomes by input index rather than filename, so a
  failed file cannot cause a successful file with the same name to be retried.

Validation:

- 448 tests in 46 files pass, including six new export API cases and two export
  panel cases. The API tests use the real Supabase query builder with a simulated
  PostgREST endpoint, including a response cap smaller than the requested page.
- ESLint, TypeScript and the production build pass.
- Headless Chrome smoke checks cover rendering of `/`, `/login`, `/signup`,
  `/forgot-password`, `/privacy`, `/terms`; signed-out dashboard redirection;
  and signed-out upload/export API rejection. No uncaught browser errors.

Limits:

- The configured local Supabase service at port 54321 was unavailable during
  this pass. Successful login, authenticated dashboard interactions, live
  database queries, real extraction, inbound AgentMail and Trigger.dev execution
  could not be verified end to end. No production data or settings were changed.
- The upload outcome fix was checked in code and by TypeScript/build, without
  an authenticated browser upload test.
