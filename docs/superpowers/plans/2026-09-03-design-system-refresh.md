# Design System Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic dark theme (plain black/white/gray, Inter font) with the
refined dark-first token system referenced from unabyss.com — new color roles, body/mono
fonts, and a single documented brand accent — applied across dashboard, landing, and auth,
and retire the two stale design docs that no longer reflect reality.

**Architecture:** All visual changes flow from CSS custom properties in
`src/app/globals.css` plus a font swap in the two files that instantiate
`next/font/google` (`layout.tsx`, `global-error.tsx`). Because nearly every component
already consumes semantic Tailwind classes (`bg-background`, `text-foreground`,
`bg-card`, …) bound to those variables, changing the variables recolors the whole app
without touching component markup. The remaining work is narrow: introduce one new
`--brand` token pair and swap 7 files' literal `#E8FF47`/`#0a0a0a` hex onto it, then bring
the docs back in sync with what's actually shipped.

**Tech Stack:** Next.js App Router, Tailwind CSS v4 (`@theme inline`), `next/font/google`,
shadcn/ui (Base UI primitives).

**Spec:** [docs/superpowers/specs/2026-09-03-design-system-refresh.md](../specs/2026-09-03-design-system-refresh.md)

## Global Constraints

- Dark-only theme — no light mode branch (matches existing `forcedTheme="dark"` in
  `src/components/theme-provider.tsx`, which is untouched by this plan).
- Keep lime `#E8FF47` as the app's one accent color — do not remove it, do not spread it
  onto generic hover states (those use the new neutral `--accent` wash instead).
- Do not touch `Outfit` (heading font) — it's an established, actively-used display font
  (30+ call sites) and out of scope for this refresh.
- Do not touch `src/components/landing/*`, `src/components/auth/*`, or the
  `.landing-shell`/`.auth-aurora` CSS blocks in `globals.css` beyond what the global font
  swap gives them automatically — those are already in good shape per the spec.
- No new unit tests: per `.claude/rules/testing.md`, UI/styling work is verified manually
  in-browser, not with Vitest. Every task's "test" step is lint + typecheck + a visual
  check, not a `.test.ts` file.
- No raw hex colors introduced in `.tsx` files — every color must resolve through a CSS
  variable / Tailwind semantic class (existing anti-pattern rule in
  `docs/DESIGN-SYSTEM.md`, being carried forward).

---

### Task 1: Global tokens — fonts and colors

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/global-error.tsx`
- Modify: `src/app/globals.css:1-12` (theme inline font/color mapping)
- Modify: `src/app/globals.css:101-194` (`:root` token block + removal of `.dark` block)

**Interfaces:**
- Produces: CSS custom properties `--background`, `--foreground`, `--card`,
  `--popover`, `--primary`, `--primary-foreground`, `--secondary`, `--muted`,
  `--muted-foreground`, `--accent`, `--accent-foreground`, `--border`, `--input`,
  `--ring`, `--brand`, `--brand-foreground`, `--color-text-primary`,
  `--color-text-secondary`, `--color-text-tertiary`, `--chart-1..5`, `--nav-*`,
  `--sidebar*` — consumed by every component via Tailwind's semantic classes (`bg-brand`,
  `text-brand`, etc. become available after this task). Later tasks (2) rely on
  `bg-brand`/`text-brand`/`border-brand` existing.

- [ ] **Step 1: Swap the font imports in `src/app/layout.tsx`**

Replace the whole file with:

```tsx
import type { Metadata } from "next";
import { Lexend, Geist_Mono, Outfit } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Invoice Reader",
  description: "AI-powered invoice inbox",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${lexend.variable} ${outfit.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Swap the font imports in `src/app/global-error.tsx`**

This file loads its own fonts (Next.js requires `global-error.tsx` to render a full
`<html>`/`<body>` independently of the root layout). Replace lines 1-33:

```tsx
"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Lexend, Outfit } from "next/font/google"

import "./globals.css"

const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
})

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
})

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Unhandled global error", error.digest, error)
  }, [error])

  return (
    <html
      lang="en"
      className={`dark ${lexend.variable} ${outfit.variable} h-full antialiased`}
    >
```

Leave the rest of the file (the `<body>` onward) unchanged.

- [ ] **Step 3: Update the font/color variable mapping in `src/app/globals.css`**

Find (lines 7-12):

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-inter);
  --font-mono: var(--font-jetbrains-mono);
  --font-heading: var(--font-sans);
```

Replace with:

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-lexend);
  --font-mono: var(--font-geist-mono);
  --font-heading: var(--font-sans);
  --color-brand: var(--brand);
  --color-brand-foreground: var(--brand-foreground);
```

- [ ] **Step 4: Replace the `:root` token block and delete the `.dark` block**

Find the `:root { ... }` block (lines 101-144) through the end of the following
`.dark { ... }` block (line 187) — i.e. everything from:

```css
:root {
  --background: hsl(0 0% 100%);
```

through the closing brace of:

```css
.dark {
  --background: hsl(0 0% 4%);
  ...
  --sidebar-ring: hsl(0 0% 45%);
}
```

and replace that entire span with a single `:root` block (no `.dark` block — the app is
forced dark, so one token set is the single source of truth):

```css
:root {
  /* ── Base surfaces — dark-only theme, tokens sourced from unabyss.com ──── */
  --background: #191817;
  --foreground: lab(98.26 0 0);
  --card: lab(12 1.5 2.5);
  --card-foreground: lab(98.26 0 0);
  --popover: lab(12 1.5 2.5);
  --popover-foreground: lab(98.26 0 0);
  --primary: lab(98.26 0 0);
  --primary-foreground: #000000;
  --secondary: oklab(0.1702 -0.00000168182 0.00000399299);
  --secondary-foreground: lab(98.26 0 0);
  --muted: oklab(0.1702 -0.00000168182 0.00000399299);
  --muted-foreground: lab(84.92 0 0);
  --accent: oklab(0.999998 -0.00000980496 0.0000234246 / 0.045);
  --accent-foreground: lab(98.26 0 0);
  --destructive: hsl(0 72% 55%);
  --destructive-foreground: hsl(0 0% 98%);
  --border: lab(100 0 0 / 0.1);
  --input: lab(100 0 0 / 0.1);
  --ring: lab(90 0 0);
  --radius: 0.625rem;

  /* ── Brand accent — the app's one signature color, used deliberately ───── */
  --brand: #e8ff47;
  --brand-foreground: #0a0a0a;

  /* ── Text tiers (see docs/DESIGN-SYSTEM.md) ─────────────────────────────── */
  --color-text-primary: lab(98.26 0 0);
  --color-text-secondary: lab(84.92 0 0);
  --color-text-tertiary: lab(96.52 0 0);

  /* ── Charts — brand marks the primary series, neutrals fill the rest ───── */
  --chart-1: var(--brand);
  --chart-2: lab(84.92 0 0);
  --chart-3: lab(66.13 0 0);
  --chart-4: oklab(0.1702 -0.00000168182 0.00000399299);
  --chart-5: lab(15.204 0 0);

  /* ── Sidebar — same base surfaces as the shell; active state is the brand ── */
  --nav-bg: var(--background);
  --nav-hover: var(--secondary);
  --nav-active: var(--card);
  --nav-border: lab(15.204 0 0);
  --nav-text: var(--foreground);
  --nav-muted: var(--color-text-secondary);
  --nav-label: var(--color-text-tertiary);

  --sidebar: var(--nav-bg);
  --sidebar-foreground: var(--nav-text);
  --sidebar-primary: var(--brand);
  --sidebar-primary-foreground: var(--brand-foreground);
  --sidebar-accent: var(--nav-active);
  --sidebar-accent-foreground: var(--nav-text);
  --sidebar-border: var(--nav-border);
  --sidebar-ring: var(--ring);

  --sidebar-width: 240px;
  --sidebar-collapsed-width: 56px;
  --sidebar-current-width: 240px;
}
```

Note: `--radius` is unchanged (`0.625rem` = 10px). The derived scale in the `@theme
inline` block (`--radius-sm` 6px / `--radius-md` 8px / `--radius-lg` 10px / `--radius-xl`
14px / `--radius-2xl` 18px) already matches the `radius.xs/sm/md/xl` = `8/10/14/18px`
scale from the spec exactly — no change needed there.

- [ ] **Step 5: Verify — lint, typecheck, visual check**

```bash
npm run lint
npx tsc --noEmit
```

Both must report zero errors. Then start the dev server and open the dashboard
(`/dashboard`) and the landing page (`/`) in a browser: confirm the background reads as a
warm near-black (`#191817`, not pure black `#000` or pure gray), text is legible, and no
console errors mention a missing font or invalid CSS color function.

- [ ] **Step 6: Commit**

```bash
git add src/app/layout.tsx src/app/global-error.tsx src/app/globals.css
git commit -m "feat: refresh design tokens to unabyss.com-referenced palette and fonts

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Route the lime accent through the new `--brand` token

**Files:**
- Modify: `src/components/dashboard/app-sidebar.tsx`
- Modify: `src/components/dashboard/site-header.tsx`
- Modify: `src/components/dashboard/coming-soon.tsx`
- Modify: `src/components/dashboard/vendors/subscription-confirm-buttons.tsx`
- Modify: `src/components/dashboard/vendors/vendors-list.tsx`
- Modify: `src/components/dashboard/inbox/inbox-status-badge.tsx`
- Modify: `src/components/dashboard/inbox/inbox-view.tsx`

**Interfaces:**
- Consumes: `bg-brand`, `text-brand`, `border-brand`, `bg-brand-foreground` Tailwind
  classes produced by Task 1's `--color-brand`/`--color-brand-foreground` mapping.
- Produces: no raw `#E8FF47`/`#0a0a0a` hex literals remain in these 7 files (verified by
  grep in Step 8).

This task is a mechanical find/replace — same visual result (same color, same opacity
modifiers), just resolved through the token instead of a literal hex string, per the
existing "no raw hex in `.tsx`" rule.

- [ ] **Step 1: `src/components/dashboard/app-sidebar.tsx`**

Replace:
```tsx
          ? "border-[#E8FF47]/35 bg-[#E8FF47]/15 text-[#E8FF47]"
```
with:
```tsx
          ? "border-brand/35 bg-brand/15 text-brand"
```

Replace:
```tsx
              <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-zinc-100 ring-2 ring-[#0a0a0a]" />
```
with:
```tsx
              <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-zinc-100 ring-2 ring-brand-foreground" />
```

Replace:
```tsx
                          isActive &&
                            "bg-[#E8FF47]/12 text-[#E8FF47] data-[active=true]:bg-[#E8FF47]/12 data-[active=true]:text-[#E8FF47]"
```
with:
```tsx
                          isActive &&
                            "bg-brand/12 text-brand data-[active=true]:bg-brand/12 data-[active=true]:text-brand"
```

- [ ] **Step 2: `src/components/dashboard/site-header.tsx`**

Replace:
```tsx
                    ? "border-[#E8FF47]/35 bg-[#E8FF47]/10 text-[#E8FF47]"
```
with:
```tsx
                    ? "border-brand/35 bg-brand/10 text-brand"
```

- [ ] **Step 3: `src/components/dashboard/coming-soon.tsx`**

Replace:
```tsx
      <div className="relative mb-6 flex size-16 items-center justify-center rounded-2xl border border-white/10 bg-[#E8FF47]/10 text-[#E8FF47]">
        <Icon className="size-7" strokeWidth={1.75} />
        <span className="absolute -right-2 -top-2 inline-flex items-center gap-1 rounded-full border border-[#E8FF47]/30 bg-[#0a0a0a] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#E8FF47]">
```
with:
```tsx
      <div className="relative mb-6 flex size-16 items-center justify-center rounded-2xl border border-white/10 bg-brand/10 text-brand">
        <Icon className="size-7" strokeWidth={1.75} />
        <span className="absolute -right-2 -top-2 inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand-foreground px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand">
```

Replace:
```tsx
        className="mt-8 inline-flex h-10 items-center justify-center rounded-full bg-[#E8FF47] px-5 text-sm font-semibold text-[#0a0a0a] transition-colors hover:bg-[#E8FF47]/90"
```
with:
```tsx
        className="mt-8 inline-flex h-10 items-center justify-center rounded-full bg-brand px-5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand/90"
```

- [ ] **Step 4: `src/components/dashboard/vendors/subscription-confirm-buttons.tsx`**

Replace:
```tsx
        className="bg-[#E8FF47] text-[#0a0a0a] hover:bg-[#E8FF47]/90"
```
with:
```tsx
        className="bg-brand text-brand-foreground hover:bg-brand/90"
```

- [ ] **Step 5: `src/components/dashboard/vendors/vendors-list.tsx`**

Replace:
```tsx
    <Badge variant="outline" className="border-[#E8FF47]/35 bg-[#E8FF47]/10 text-[#E8FF47]">
```
with:
```tsx
    <Badge variant="outline" className="border-brand/35 bg-brand/10 text-brand">
```

- [ ] **Step 6: `src/components/dashboard/inbox/inbox-status-badge.tsx`**

Replace:
```tsx
    className: "border-[#E8FF47]/25 bg-[#E8FF47]/10 text-[#E8FF47]",
```
with:
```tsx
    className: "border-brand/25 bg-brand/10 text-brand",
```

- [ ] **Step 7: `src/components/dashboard/inbox/inbox-view.tsx`**

Replace each occurrence (7 total) — same literal-to-token swap, no behavior change:

```tsx
                      className={cn(
                        "relative text-muted-foreground",
                        filtersActive && "text-[#E8FF47]"
                      )}
```
→
```tsx
                      className={cn(
                        "relative text-muted-foreground",
                        filtersActive && "text-brand"
                      )}
```

```tsx
                    <span className="absolute top-1 right-1 size-1.5 rounded-full bg-[#E8FF47]" />
```
→
```tsx
                    <span className="absolute top-1 right-1 size-1.5 rounded-full bg-brand" />
```

```tsx
                    {INBOX_STATUS_FILTER_OPTIONS.map((opt) => (
                      <DropdownMenuItem
                        key={opt.value}
                        onClick={() => navigate({ status: opt.value })}
                      >
                        <span className="flex-1">{opt.label}</span>
                        {query.status === opt.value ? (
                          <Check className="size-3.5 text-[#E8FF47]" />
                        ) : null}
                      </DropdownMenuItem>
                    ))}
```
→
```tsx
                    {INBOX_STATUS_FILTER_OPTIONS.map((opt) => (
                      <DropdownMenuItem
                        key={opt.value}
                        onClick={() => navigate({ status: opt.value })}
                      >
                        <span className="flex-1">{opt.label}</span>
                        {query.status === opt.value ? (
                          <Check className="size-3.5 text-brand" />
                        ) : null}
                      </DropdownMenuItem>
                    ))}
```

And the source dropdown, same file:
```tsx
                    {INBOX_SOURCE_FILTER_OPTIONS.map((opt) => (
                      <DropdownMenuItem
                        key={opt.value}
                        onClick={() => navigate({ source: opt.value })}
                      >
                        <span className="flex-1">{opt.label}</span>
                        {query.source === opt.value ? (
                          <Check className="size-3.5 text-[#E8FF47]" />
                        ) : null}
                      </DropdownMenuItem>
                    ))}
```
→
```tsx
                    {INBOX_SOURCE_FILTER_OPTIONS.map((opt) => (
                      <DropdownMenuItem
                        key={opt.value}
                        onClick={() => navigate({ source: opt.value })}
                      >
                        <span className="flex-1">{opt.label}</span>
                        {query.source === opt.value ? (
                          <Check className="size-3.5 text-brand" />
                        ) : null}
                      </DropdownMenuItem>
                    ))}
```

```tsx
                              className={cn(
                                "flex w-full gap-3 border-l-2 px-3 py-3 text-left transition-colors",
                                active
                                  ? "border-l-[#E8FF47] bg-[#E8FF47]/8"
                                  : "border-l-transparent hover:bg-muted/40"
                              )}
```
→
```tsx
                              className={cn(
                                "flex w-full gap-3 border-l-2 px-3 py-3 text-left transition-colors",
                                active
                                  ? "border-l-brand bg-brand/8"
                                  : "border-l-transparent hover:bg-muted/40"
                              )}
```

```tsx
      className="inline-flex h-6 items-center gap-1 rounded-full border border-[#E8FF47]/25 bg-[#E8FF47]/10 px-2 text-[11px] font-medium text-[#E8FF47]"
```
→
```tsx
      className="inline-flex h-6 items-center gap-1 rounded-full border border-brand/25 bg-brand/10 px-2 text-[11px] font-medium text-brand"
```

```tsx
            <TabsTrigger
              value="overview"
              className="rounded-none px-0 data-active:text-foreground after:bg-[#E8FF47]"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="lines"
              className="rounded-none px-0 data-active:text-foreground after:bg-[#E8FF47]"
            >
              Line Items
            </TabsTrigger>
```
→
```tsx
            <TabsTrigger
              value="overview"
              className="rounded-none px-0 data-active:text-foreground after:bg-brand"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="lines"
              className="rounded-none px-0 data-active:text-foreground after:bg-brand"
            >
              Line Items
            </TabsTrigger>
```

```tsx
        highlight && "border-[#E8FF47]/25 bg-[#E8FF47]/8"
```
→
```tsx
        highlight && "border-brand/25 bg-brand/8"
```

```tsx
              <dd className="rounded bg-[#E8FF47]/70 px-1.5 font-medium">
```
and
```tsx
              <dd className="rounded bg-[#E8FF47]/70 px-1.5 font-semibold">
```
→
```tsx
              <dd className="rounded bg-brand/70 px-1.5 font-medium">
```
and
```tsx
              <dd className="rounded bg-brand/70 px-1.5 font-semibold">
```

- [ ] **Step 8: Verify no raw brand hex remains**

```bash
grep -rn "#E8FF47\|#e8ff47" src/components/dashboard
```

Expected: no output (empty). (The landing/auth files and `globals.css`'s
`--landing-*`/`--brand` definitions are expected to still contain the literal hex — that's
correct, they're the source-of-truth definitions, not call sites.)

- [ ] **Step 9: Lint, typecheck, visual check**

```bash
npm run lint
npx tsc --noEmit
```

Then in the browser: open `/dashboard`, confirm the sidebar's active nav item, the inbox
filter/status badges, the "Still using it" subscription button, and the coming-soon pages
all still show the same lime accent as before — pixel-identical, just token-backed now.

- [ ] **Step 10: Commit**

```bash
git add src/components/dashboard
git commit -m "refactor: route lime accent through --brand token instead of raw hex

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Rewrite `docs/DESIGN-SYSTEM.md`

**Files:**
- Modify: `docs/DESIGN-SYSTEM.md` (full rewrite)

**Interfaces:**
- Consumes: the token values established in Task 1 (`--background`, `--brand`, type
  scale, radius scale, motion durations).
- Produces: the single accurate source of truth other docs/rules point to (referenced by
  `.claude/rules/components.md`, updated in Task 4).

- [ ] **Step 1: Replace the file contents**

```markdown
# DESIGN SYSTEM
> Token-driven, dark-only UI system. Implementation-ready.
> Palette, type scale, and spacing referenced from unabyss.com; lime `#E8FF47` is this
> app's own brand accent, layered on top.

---

## PHILOSOPHY

- Dark-only — no light theme branch. `ThemeProvider` forces `dark` (see
  `src/components/theme-provider.tsx`).
- Hierarchy from **weight + color**, not size.
- Lime `--brand` (`#E8FF47`) is the **one** accent color — used deliberately (CTAs,
  active nav indicator, links, focus highlights on brand elements), never as a generic
  hover background.
- No raw hex in `.tsx` — every color resolves through a CSS variable / Tailwind semantic
  class (`bg-background`, `text-brand`, etc.).
- Every interactive element defines all 7 states (see STATE RULES).

---

## FONT

- Sans (body/UI): **Lexend**, via `next/font/google`, CSS var `--font-lexend`.
- Heading/display: **Outfit**, via `next/font/google`, CSS var `--font-outfit` — applied
  directly with `font-[family-name:var(--font-outfit)]` at heading call sites (not
  through `--font-heading`, which currently aliases to the body sans for
  `CardTitle`-style components).
- Mono: **Geist Mono**, via `next/font/google`, CSS var `--font-geist-mono`.

Base body: 16px / 24px line-height, weight 400, antialiased.

---

## TYPE SCALE

| Token | Size | Usage |
|-------|------|-------|
| `font.size.xs` | 11px | Timestamps, section labels, badge text |
| `font.size.sm` | 12px | Meta text, muted captions |
| `font.size.md` | 12.8px | Dense table/list body text |
| `font.size.lg` | 14px | Default body, nav items, card titles |
| `font.size.xl` | 16px | Base body size |
| `font.size.2xl` | 18px | Small section headings |
| `font.size.3xl` | 20px | Page subheadings |
| `font.size.4xl` | 24px | Page titles (with `font-outfit`) |

Applied via arbitrary Tailwind values (`text-[13px]`), matching the existing convention
in this codebase — Tailwind's default type scale is not used directly.

---

## COLOR TOKENS

### `src/app/globals.css` — full token map (dark-only; single `:root` block)

```css
:root {
  --background:            #191817;
  --foreground:             lab(98.26 0 0);
  --card:                   lab(12 1.5 2.5);
  --card-foreground:        lab(98.26 0 0);
  --popover:                lab(12 1.5 2.5);
  --popover-foreground:     lab(98.26 0 0);
  --primary:                lab(98.26 0 0);
  --primary-foreground:     #000000;
  --secondary:              oklab(0.1702 -0.00000168182 0.00000399299);
  --secondary-foreground:   lab(98.26 0 0);
  --muted:                  oklab(0.1702 -0.00000168182 0.00000399299);
  --muted-foreground:       lab(84.92 0 0);
  --accent:                 oklab(0.999998 -0.00000980496 0.0000234246 / 0.045);
  --accent-foreground:      lab(98.26 0 0);
  --border:                 lab(100 0 0 / 0.1);
  --input:                  lab(100 0 0 / 0.1);
  --ring:                   lab(90 0 0);

  --brand:                  #e8ff47;
  --brand-foreground:       #0a0a0a;

  --color-text-primary:     lab(98.26 0 0);
  --color-text-secondary:   lab(84.92 0 0);
  --color-text-tertiary:    lab(96.52 0 0);
}
```

| Role | Token class | Use for |
|------|-------------|---------|
| Page background | `bg-background` | App shell, page canvas |
| Raised panel | `bg-card` / `bg-popover` | Cards, dropdowns, modals, sheets |
| Primary text | `text-foreground` | Default body/UI text |
| Secondary text | `text-muted-foreground` | Captions, meta, timestamps |
| Generic hover wash | `bg-accent` | Neutral hover/active background — **not** the brand color |
| Monochrome CTA | `bg-primary text-primary-foreground` | Default button |
| Brand accent | `bg-brand` / `text-brand` / `border-brand` | CTAs, active nav item, links, focus highlights — used sparingly |
| Hairline border | `border-border` | Card/input/table borders (white @ 10% opacity) |

---

## SPACING SCALE

Tailwind's default numeric spacing scale already matches the reference 1-8 step scale —
no custom spacing tokens needed:

| Role | Tailwind class | Value |
|------|-----------------|-------|
| Icon gap / micro spacing | `gap-1` | 4px |
| Nav icon gap, badge padding-y | `gap-1.5` / `py-1.5` | 6px |
| Inner padding small | `p-2` | 8px |
| Nav item padding-x | `px-2.5` | 10px |
| Card padding small | `p-3` | 12px |
| — | `p-3.5` | 14px |
| Section gap | `gap-4` | 16px |
| Card padding | `p-6` | 24px |

---

## RADIUS TOKENS

Derived from `--radius: 0.625rem` (10px) via the `@theme inline` scale — already matches
the reference `xs/sm/md/xl` scale exactly:

| Token | Tailwind class | Value | Usage |
|-------|-----------------|-------|-------|
| `radius.xs` | `rounded-md` | 8px | Badges, tags, inputs, icon wrappers |
| `radius.sm` | `rounded-lg` | 10px | Buttons, nav items |
| `radius.md` | `rounded-xl` | 14px | Cards, dropdowns, modals |
| `radius.xl` | `rounded-2xl` | 18px | Large surfaces |
| — | `rounded-full` | — | Avatars, pills (not part of the source scale, kept as-is) |

---

## MOTION TOKENS

| Token | Value | Usage |
|-------|-------|-------|
| `motion.duration.instant` | `150ms ease` | Hover color changes, button states (extends the reference scale — needed for snappy micro-feedback) |
| `motion.duration.fast` | `200ms ease` | Sidebar collapse, dropdown open |
| `motion.duration.normal` | `300ms ease` | Page transitions, sheet open |

**All transitions MUST use one of these 3 values only.**

---

## SHADOW & BORDER

This codebase already uses a "1px ring as hairline border" technique in several places
(`ring-1 ring-foreground/10` on `Card`, `shadow-[0_0_0_1px_var(--sidebar-border)]` on the
sidebar rail) — this is the same idea as the reference `shadow.1` token, just expressed
as a ring/box-shadow instead of a `border` color, and it should stay the default for
cards/panels rather than a plain `border`:

```
Cards / raised panels:  ring-1 ring-foreground/10 (no border, no shadow-md/lg)
Sidebar rail hairline:  shadow-[0_0_0_1px_var(--sidebar-border)]
Dropdowns / popovers:   shadow-lg ring-1 ring-foreground/10 (elevated — the one place a
                         real drop shadow is allowed, matching reference `shadow.2`)
Modals / sheets:        shadow-xl (same elevated-overlay exception)
```

Only dropdowns, popovers, modals, and sheets get a real drop shadow — everything else
uses the hairline ring technique or no shadow at all.

---

## SIDEBAR RULES

```
Background:    bg-sidebar (same warm near-black as the page — not pure black)
Border right:  border-r border-sidebar-border
Shadow:        none

Nav item default:  text-nav-muted text-[13px] rounded-lg px-2.5 py-1.5
Nav item hover:    bg-nav-hover text-nav-text — 150ms ease
Nav item active:   bg-brand/12 text-brand font-medium

Section label:     text-[11px] text-nav-label uppercase tracking-widest
                   px-2.5 mb-1 mt-4
```

---

## STATE RULES

Every interactive element **must** define all 7 states:

| State | Rule |
|-------|------|
| `default` | Normal render |
| `hover` | `bg-accent` — `duration-150` (neutral wash; brand-colored elements use `bg-brand/90`) |
| `focus-visible` | `ring-2 ring-ring ring-offset-2` — never hidden |
| `active` | `opacity-90 scale-[0.99]` |
| `disabled` | `opacity-50 cursor-not-allowed pointer-events-none` |
| `loading` | Spinner visible, dimensions preserved, no layout shift |
| `error` | `border-destructive text-destructive focus-visible:ring-destructive/20` |

---

## ANTI-PATTERNS

```
❌ Raw hex in .tsx files — use CSS variable-backed Tailwind classes (bg-brand, not bg-[#E8FF47])
❌ The brand color as a generic hover background — use bg-accent instead
❌ A light theme branch — this app is dark-only
❌ shadow-md / shadow-lg on cards, inputs, nav, sidebar
❌ Arbitrary transition durations outside 150/200/300ms
❌ inline style={{ }} anywhere
❌ Low-contrast text (fails WCAG AA)
❌ Hidden focus indicators
```

---

## QA CHECKLIST

```
Typography
[ ] Body font is Lexend, headings use Outfit, mono is Geist Mono
[ ] No raw pixel sizes outside the documented type scale

Colors
[ ] Background reads as #191817 (warm near-black), not pure black or gray
[ ] All colors reference CSS variables — no raw hex in .tsx files
[ ] Brand lime appears only on CTAs / active nav / links / focus — not generic hovers

Spacing & Radius
[ ] Radius uses rounded-md/lg/xl/2xl (8/10/14/18px) — no other rounded-* except rounded-full
[ ] Spacing uses Tailwind's default numeric scale

Motion
[ ] Hover: 150ms ease. Sidebar/dropdown: 200ms ease. Page/sheet: 300ms ease.

Code quality
[ ] Zero TypeScript errors, zero ESLint warnings
[ ] No inline style={{}}
```
```

- [ ] **Step 2: Commit**

```bash
git add docs/DESIGN-SYSTEM.md
git commit -m "docs: rewrite DESIGN-SYSTEM.md to match the actual dark+brand theme

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Retire stale design docs

**Files:**
- Delete: `docs/DASHBOARD.md`
- Delete: `DESIGN.md` (repo root)
- Modify: `.claude/rules/components.md`

**Interfaces:**
- Consumes: nothing new.
- Produces: no dangling references to the deleted files anywhere in the repo (verified
  in Step 4).

- [ ] **Step 1: Delete `docs/DASHBOARD.md`**

```bash
git rm docs/DASHBOARD.md
```

This file is a one-time project-bootstrap prompt (asks for a project name and package
manager, scaffolds a brand-new generic admin dashboard from `create-next-app`). It
already served its purpose when this project was first scaffolded and no longer matches
the real file structure (`src/app/dashboard/`, not `(dashboard)/`; `app-sidebar.tsx`, not
`sidebar.tsx`; no `Orders`/`Products` nav items exist). Keeping it around actively
misleads anyone who reads it expecting current state.

- [ ] **Step 2: Delete the root `DESIGN.md`**

```bash
git rm DESIGN.md
```

Its useful content (the unabyss.com-referenced tokens) has been folded into
`docs/DESIGN-SYSTEM.md` in Task 3. Docs belong in `docs/`, not the repo root, and this
one's literal brand text ("Rerun", "Eve booking app") doesn't apply to this project at
all — it was boilerplate from whatever tool captured the tokens.

- [ ] **Step 3: Update `.claude/rules/components.md`**

Find:
```markdown
Dark-mode-only design tokens, lime accent (`#E8FF47`), Outfit display font - full details
in [`docs/DESIGN-SYSTEM.md`](../../docs/DESIGN-SYSTEM.md) and
[`docs/DASHBOARD.md`](../../docs/DASHBOARD.md). Don't introduce new one-off colors/fonts
outside those tokens without checking there first.
```

Replace with:
```markdown
Dark-mode-only design tokens, lime accent (`#E8FF47`, exposed as `bg-brand`/`text-brand`),
Lexend body font, Outfit display font — full details in
[`docs/DESIGN-SYSTEM.md`](../../docs/DESIGN-SYSTEM.md). Don't introduce new one-off
colors/fonts outside those tokens without checking there first.
```

- [ ] **Step 4: Verify no dangling references remain**

```bash
grep -rn "DASHBOARD.md" --include="*.md" --include="*.ts" --include="*.tsx" . \
  --exclude-dir=node_modules --exclude-dir=.next
```

Expected: no output (the file's own git history doesn't count — this greps the working
tree). If any doc still links to `docs/DASHBOARD.md`, update that link to point to
`docs/DESIGN-SYSTEM.md` instead.

- [ ] **Step 5: Commit**

```bash
git add -A docs/DASHBOARD.md DESIGN.md .claude/rules/components.md
git commit -m "docs: retire stale DASHBOARD.md bootstrap prompt and root DESIGN.md

Both were superseded by the rewritten docs/DESIGN-SYSTEM.md.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Full verification and light docs audit

**Files:**
- None modified by default — this task verifies Tasks 1-4 and only touches a
  `docs/*.md` file if Step 3 finds a concrete inaccuracy.

**Interfaces:**
- Consumes: the finished app from Tasks 1-4.
- Produces: a pass/fail report on the QA checklist in `docs/DESIGN-SYSTEM.md`.

- [ ] **Step 1: Full build + lint + typecheck**

```bash
npm run build
npm run lint
npx tsc --noEmit
```

All three must succeed with zero errors before continuing.

- [ ] **Step 2: Manual smoke test in-browser**

Start the dev server and visit each of the following, checking against the QA checklist
in `docs/DESIGN-SYSTEM.md` (background tone, brand usage, focus rings, no layout shift):

- `/dashboard` (overview)
- `/dashboard/invoices`
- `/dashboard/inbox` (open an invoice detail, exercise the status/source filter dropdown)
- `/dashboard/vendors` (open the vendor detail sheet, check the subscription confirm
  buttons if a vendor has a due subscription)
- `/dashboard/analytics`
- `/dashboard/automation`
- `/dashboard/exports`
- `/dashboard/settings`
- `/` (landing page)
- `/login` and `/signup`
- `/terms` and `/privacy`
- Trigger `not-found.tsx` (visit a nonexistent route) and confirm it renders with the new
  fonts/colors correctly

For each, confirm: no console errors, focus-visible rings are visible on Tab, and text
contrast looks correct (no muted-on-muted illegible combinations).

- [ ] **Step 3: Light staleness spot-check of the remaining docs**

For each of these, skim it against the current code it describes and fix only concrete,
small inaccuracies found (file paths, function names, removed features) — this is not a
rewrite pass:

```
docs/DEVELOPMENT.md
docs/billing-mode.md
docs/billing-polar.md
docs/deploy.md
docs/legal.md
docs/automation.md
docs/analytics.md
docs/subscription-reminders.md
docs/vendor-stats-scalability.md
docs/webhook-task-queue.md
docs/system-hardening.md
docs/third-party-services.md
```

If a doc references a file or function that no longer exists, grep to confirm it's
really gone, then either fix the reference or note the drift — don't restructure the
whole document.

- [ ] **Step 4: Commit any doc fixes from Step 3**

Only if Step 3 found something to fix:

```bash
git add docs/<fixed-file>.md
git commit -m "docs: fix stale reference in <fixed-file>.md

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

If nothing needed fixing, skip this step — no empty commit.
