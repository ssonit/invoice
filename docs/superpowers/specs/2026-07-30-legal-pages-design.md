# Legal Pages Design Spec

**Date:** 2026-07-30
**Status:** Implemented
**Plan:** [2026-07-30-legal-pages.md](../plans/2026-07-30-legal-pages.md)

## Overview

Static `/terms` and `/privacy` pages with bilingual draft legal copy, wired from the landing footer and signup page. Sufficient for MoR (Lemon Squeezy) / store review; lawyer replaces copy later.

## Design decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Content storage | `src/lib/legal/dictionary.ts` | No MDX, CMS, or DB — typed TS, locale-aware, simple to hand to a lawyer |
| UI shell | `LegalPageShell` client component | Shares landing CSS vars, `BrandLogo`, locale toggle, minimal dependency footprint |
| Locale | Reuse `LandingI18nProvider` | Same locale mechanism as landing (localStorage + `useSyncExternalStore`) |
| Auth page locale | English-only | Avoid pulling full landing i18n into auth; hardcode agreed-to legal line |
| Banner | Amber callout | Visibly distinct from page content, impossible to miss |

## Component tree

```
/terms/page.tsx (RSC, metadata)
  └── LegalPageClient (client boundary)
       ├── LandingI18nProvider
       └── LandingThemeProvider
            └── LegalPageShell

/privacy/page.tsx (RSC, metadata)
  └── LegalPageClient (shared, imported from @/app/terms/page-client)
       └── (same providers + shell)
```

## Data flow

```
legal/dictionary.ts → getLegalCopy(locale) → LegalPageShell
landing/dictionary.ts → LandingI18nProvider → useLandingI18n().locale
```

Legal copy is separate from landing copy (`src/lib/landing/dictionary.ts`) to avoid bloating the landing dictionary. Legal pages call `getLegalCopy(locale)` directly from the legal dictionary, not through the `t()` function.

## CSS

All styling uses landing CSS variables (`--landing-bg`, `--landing-fg`, `--landing-muted`, `--landing-border`, `--landing-card`), which `LandingThemeProvider` sets on a wrapper div. No new design tokens introduced.

## Accessibility

- Semantic HTML (`<article>`, `<section>`, `<h1>`/`<h2>` hierarchy)
- Locale toggle is a button with visible text label (EN/VI)
- Draft banner uses amber color (not red) — attention, not alarm

## Out of scope

- Cookie consent banner
- DPA generator
- Version history / changelog table
- CMS integration
- `/legal` index page
