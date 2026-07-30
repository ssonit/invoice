# Legal Pages Implementation Plan

**Date:** 2026-07-30
**Status:** Complete
**Spec:** [2026-07-30-legal-pages-design.md](../specs/2026-07-30-legal-pages-design.md)

## Tasks

### 1. Legal dictionary (`src/lib/legal/dictionary.ts`)
- [x] Define `LegalLocale`, `LegalSection`, `LegalPage`, `LegalPages` types
- [x] Write EN draft: Terms (9 sections) + Privacy (11 sections)
- [x] Write VI draft: Terms (9 sections) + Privacy (11 sections)
- [x] Banner: draft-not-legal-advice warning (both locales)
- [x] Export `getLegalCopy(locale)` accessor

### 2. LegalPageShell (`src/components/legal/legal-page-shell.tsx`)
- [x] Client component using `useLandingI18n()` for locale
- [x] Header: `BrandLogo` + EN/VI toggle button
- [x] Main: back-home link, title, updated date, amber draft banner, section list
- [x] Footer: copyright + links to both legal pages
- [x] Prose max-w-3xl, no dashboard sidebar

### 3. Pages
- [x] `src/app/terms/page.tsx` — RSC with metadata, renders `LegalPageClient`
- [x] `src/app/terms/page-client.tsx` — shared client boundary wrapping `LegalPageShell` in providers
- [x] `src/app/privacy/page.tsx` — RSC with metadata, imports `LegalPageClient` from terms

### 4. Wiring
- [x] Footer: replace inert `<span>`s with `<Link href="/terms">` / `<Link href="/privacy">`
- [x] Signup: add agree-to-legal line with linked Terms and Privacy (English-only per plan)

### 5. Documentation
- [x] `docs/superpowers/specs/2026-07-30-legal-pages-design.md`
- [x] `docs/superpowers/plans/2026-07-30-legal-pages.md` (this file)
- [x] `docs/legal.md`

## Files changed

| File | Action |
|------|--------|
| `src/lib/legal/dictionary.ts` | Created |
| `src/components/legal/legal-page-shell.tsx` | Created |
| `src/app/terms/page.tsx` | Created |
| `src/app/terms/page-client.tsx` | Created |
| `src/app/privacy/page.tsx` | Created |
| `src/components/landing/footer.tsx` | Modified (spans → Links) |
| `src/app/signup/page.tsx` | Modified (added agree line) |
| `docs/superpowers/specs/2026-07-30-legal-pages-design.md` | Created |
| `docs/superpowers/plans/2026-07-30-legal-pages.md` | Created |
| `docs/legal.md` | Created |
