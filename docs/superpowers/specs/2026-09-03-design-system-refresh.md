# Design System Refresh — Design Spec

Date: 2026-09-03

## Context

The dashboard/UI currently ships with a generic shadcn dark theme (pure black/white/gray,
`Inter` font) forced on via `ThemeProvider forcedTheme="dark"` — it works but looks
plain/generic. `docs/DESIGN-SYSTEM.md` (the documented source of truth) actually describes
a **light-first** theme that was never what shipped, and `docs/DASHBOARD.md` is a leftover
project-bootstrap prompt (asks for a project name, scaffolds a brand-new generic admin
dashboard) that no longer matches this codebase's real file structure or nav — it has
fully served its purpose and is now actively misleading.

A file `DESIGN.md` was dropped at the repo root with token values referencing
`https://unabyss.com/` — a better-looking font/color/spacing system than the current
default. The literal brand text in that file ("Rerun", "Eve booking app") is boilerplate
from whatever tool captured the tokens and does **not** apply to this project — only the
token values (font, color roles, spacing/radius/shadow/motion scale) are relevant here.

Decision (confirmed with user): adopt the unabyss.com-referenced token system as the new
visual foundation for the whole app, **while keeping the existing lime `#E8FF47` accent**
already used on the landing page and auth screens (documented in
`.claude/rules/components.md`) as the app's one signature accent color — applied
deliberately (CTAs, active nav indicator, focus/links), not as a generic hover wash.

## Goals

- Replace the generic default look with the refined neutral palette, type scale, spacing,
  radius, shadow, and motion tokens sourced from `DESIGN.md` (unabyss.com).
- Keep dark-only theming (already intentional — `forcedTheme="dark"`), keep the lime
  accent as the single brand color layered on top of the new neutral system.
- Make `docs/DESIGN-SYSTEM.md` the single, accurate source of truth again.
- Retire documentation that no longer reflects reality (`docs/DASHBOARD.md`, root
  `DESIGN.md`), fold anything still useful into `docs/DESIGN-SYSTEM.md`.

## Non-goals

- No light theme. The app stays dark-only (matches current `forcedTheme="dark"` and the
  existing lime-on-dark brand identity).
- No change to feature/business-logic docs (`billing-*.md`, `automation.md`,
  `analytics.md`, etc.) beyond a light staleness spot-check — those aren't part of the
  visual system.
- Not redesigning layout/IA (page structure, nav items, flows stay as they are) — this is
  a visual token + component-styling pass, not a UX restructure.

## Foundation tokens

### Font

- Sans (body/UI): **Lexend**, via `next/font/google`, CSS var `--font-lexend` — replaces
  `Inter`.
- Mono: **Geist Mono**, via `next/font/google`, CSS var `--font-geist-mono` — replaces
  `JetBrains Mono`.
- **`Outfit` stays untouched.** It's the established heading/display font, used directly
  via `font-[family-name:var(--font-outfit)]` at 30+ call sites across dashboard, landing,
  auth, and legal pages (also documented in `.claude/rules/components.md`). Not part of
  this refresh — only the body sans and mono fonts change.

### Color roles (dark-only; values sourced from `DESIGN.md`/unabyss.com)

Mapped onto the existing shadcn-style variable names already used in `globals.css`, plus
the custom `--color-*` names already established in `docs/DESIGN-SYSTEM.md`:

| Role | New value (source) | Notes |
|------|--------------------|-------|
| `--background` / `--color-surface-base` | `#191817` | Page base — warm near-black, not pure black |
| `--card` / `--popover` / `--color-surface-raised` | `lab(12 1.5 2.5)` | Raised panels (cards, dropdowns, modals) |
| `--muted` / `--color-surface-muted` | `oklab(0.1702 -0.00000168182 0.00000399299)` | Muted fills (skeletons, subtle backgrounds) |
| `--foreground` / `--color-text-primary` | `lab(98.26 0 0)` | Primary text — near-white, warm |
| `--muted-foreground` / `--color-text-secondary` | `lab(84.92 0 -0.0000119209)` | Secondary text |
| `--color-text-tertiary` | `lab(96.52 -0.0000298023 0.0000119209)` | Tertiary/quiet text |
| `--border` / `--input` / `--color-border-default` | `lab(100 0 0 / 0.1)` | Hairline borders — white at 10% opacity |
| `--color-border-muted` | `lab(15.204 0 -0.00000596046)` | Stronger/divider borders |
| `--accent` (generic hover wash) | `oklab(0.999998 ... / 0.045)` (`color.surface.strong`) | Neutral hover background — **not** the brand color |
| `--primary` / `--primary-foreground` | `lab(98.26 0 0)` / `#000000` | Monochrome primary button (near-white bg, black text) |
| `--brand` / `--brand-foreground` (new) | `#E8FF47` / `#0a0a0a` | The one accent color — CTAs, active nav indicator, links, focus rings. Reuses the existing `--landing-accent` value so landing/auth and dashboard share one constant. |
| `--destructive` | keep existing red scale | Unrelated to this refresh |

Sidebar keeps using `--color-surface-base`/raised tokens (still visually near-black,
consistent with the rest of the shell) with the lime brand token for the active-item
indicator instead of the current flat `#242424` block.

Simplification: since the app is forced dark and the `:root` light branch is never
rendered, collapse `globals.css` to a single dark token set instead of maintaining an
unused parallel light palette — removes dead CSS, doesn't change behavior.

### Type scale (replaces the old 12–16px scale)

| Token | Size |
|-------|------|
| `font.size.xs` | 11px |
| `font.size.sm` | 12px |
| `font.size.md` | 12.8px |
| `font.size.lg` | 14px |
| `font.size.xl` | 16px |
| `font.size.2xl` | 18px |
| `font.size.3xl` | 20px |
| `font.size.4xl` | 24px |

Base body: 16px / 24px line-height, weight 400. Applied via arbitrary Tailwind values
(`text-[13px]` etc.), matching the existing convention in this codebase.

### Spacing scale (extends the old 5-step scale to 8 steps)

`space.1..8` = `4px, 6px, 8px, 10px, 12px, 14px, 16px, 24px`.

### Radius

`radius.xs=8px` (badges/inputs), `radius.sm=10px` (buttons/nav), `radius.md=14px`
(cards/dropdowns/modals), `radius.xl=18px` (large surfaces). `rounded-full` stays for
avatars/pills (not part of the source scale, but still needed).

### Shadow

- `shadow.1` = `oklab(0.269 ... / 0.8) 0px 0px 0px 1px` — a 1px hairline "shadow-as-border"
  technique, used on cards/inputs/panels instead of a plain border color for a crisper
  edge on dark surfaces.
- `shadow.2` = `rgba(0,0,0,0.25) 0px 25px 50px -12px` — elevated overlays (dropdowns,
  modals, popovers) only, same restriction as today ("only dropdowns/modals get shadow").

### Motion

`motion.duration.fast=200ms`, `motion.duration.normal=300ms` (from `DESIGN.md`). Keep the
existing `150ms` "instant" tier from the current system for micro hover feedback — the
source doesn't define one, but dropping it would leave no fast-enough tier for
button/link hover states used throughout the app today.

## Rollout scope

1. **Docs foundation** — rewrite `docs/DESIGN-SYSTEM.md` as the single accurate source of
   truth (new tokens, updated component quick-reference, anti-patterns, QA checklist).
   Delete `docs/DASHBOARD.md` (stale bootstrap prompt) and root `DESIGN.md` (superseded).
   Update the `.claude/rules/components.md` pointer (drop the `DASHBOARD.md` reference).
2. **Font + global tokens** — `layout.tsx` font swap, `globals.css` token rewrite
   (color/spacing/radius/shadow/motion), collapse to single dark token set.
3. **shadcn UI primitives** (`src/components/ui/*`) — most inherit automatically via CSS
   variables; spot-check `button`, `input`, `card`, `badge`, `dialog`, `dropdown-menu`,
   `table`, `tabs`, `select`, `sheet`, `tooltip` for hardcoded radius/shadow that should
   move to the new token scale.
4. **Dashboard components with hardcoded hex** (7 files / 21 occurrences today:
   `coming-soon.tsx`, `site-header.tsx`, `app-sidebar.tsx`,
   `subscription-confirm-buttons.tsx`, `vendors-list.tsx`, `inbox-status-badge.tsx`,
   `inbox-view.tsx`) — replace raw hex with the new token-backed values; sidebar active
   state switches to the lime brand token.
5. **Landing & auth harmonization** — these are already dark + lime and in good shape;
   only align neutral surface/border tones and swap to `Lexend` for consistency, keep the
   lime gradient treatments as-is.
6. **QA** — update the QA checklist in `docs/DESIGN-SYSTEM.md`; manual smoke test of
   dashboard (invoices/vendors/analytics/automation/settings/exports/inbox), landing,
   login/signup, legal pages; `npm run lint` + `npx tsc --noEmit` (no unit tests needed —
   this is a styling pass, not `src/lib` logic).
7. **Light docs audit (secondary, lower priority)** — spot-check the remaining
   `docs/*.md` files (`DEVELOPMENT.md`, `billing-mode.md`, `billing-polar.md`, `deploy.md`,
   `legal.md`, `automation.md`, `analytics.md`, `subscription-reminders.md`,
   `vendor-stats-scalability.md`, `webhook-task-queue.md`, `system-hardening.md`,
   `third-party-services.md`) for obvious drift against current code; fix small
   inaccuracies inline, don't rewrite wholesale — out of scope for the visual refresh
   itself.

## Testing / verification

Per `.claude/rules/testing.md`, this is UI/visual work — not `src/lib` pure logic — so no
new unit tests. Verification is: `npm run lint`, `npx tsc --noEmit`, `npm run build`, and
an in-browser manual smoke test of every touched surface (dashboard pages, landing,
auth, legal) checking contrast, focus-visible rings, and hover/active states per the
updated QA checklist.
