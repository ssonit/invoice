# Legal pages

**Status:** Draft — not reviewed by a lawyer.

## How to replace the draft copy

1. Open `src/lib/legal/dictionary.ts`.
2. Replace the content under `en` and `vi` with lawyer-approved copy.
3. Update the `updated` date on each page.
4. Remove the amber draft banner in `src/components/legal/legal-page-shell.tsx` (or replace it with a "Last reviewed by counsel on …" note).
5. Update the placeholder contact emails (`legal@invoicereader.app`, `privacy@invoicereader.app`) to real addresses.

## How to add a new locale

1. Add a new key to `legalCopy` in `dictionary.ts` (e.g. `"fr"`).
2. Add the locale to the `LegalLocale` type union.
3. The `LegalPageShell` toggle currently only switches between `en` and `vi` — update the toggle (or replace it with a proper locale selector) to include the new locale.

## Routes

- Terms: `/terms`
- Privacy: `/privacy`

Both pages are static client-rendered content served through the Next.js App Router. No CMS, no database queries.
