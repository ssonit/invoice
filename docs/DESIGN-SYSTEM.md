# DESIGN SYSTEM
> Token-driven UI system. Zero exceptions. Implementation-ready.
> Inspired by MeiGen design token architecture.

---

## PHILOSOPHY

- Hierarchy from **weight + color**, not size
- **No shadow** on cards, nav, or inputs
- **No arbitrary values** — tokens only
- Every interactive element defines all 7 states
- Consistency over local exceptions — always

---

## FONT

### Installation
```bash
pnpm add @fontsource-variable/inter
```

### Import in `src/app/layout.tsx`
```ts
import "@fontsource-variable/inter"
```

### `src/app/globals.css`
```css
:root {
  --font-sans: "Inter Variable", "Inter Fallback",
               -apple-system, BlinkMacSystemFont,
               "Segoe UI", Roboto,
               "PingFang SC", "Microsoft YaHei",
               sans-serif;
}

body {
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 400;
  line-height: 24.8px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

### `tailwind.config.ts`
```ts
fontFamily: {
  sans: ["var(--font-sans)"],
}
```

---

## TYPE SCALE

| Token | Size | Usage |
|-------|------|-------|
| `font.size.xs` | `12px` | Muted text, timestamps, badge labels |
| `font.size.sm` | `13px` | Body, nav items, table cells, card titles |
| `font.size.md` | `14px` | Base body (default) |
| `font.size.lg` | `15px` | Page titles (h1) |
| `font.size.xl` | `16px` | Reserved — rarely used |

### Usage per element

```
Page title (h1):        text-[15px] font-semibold tracking-tight text-[#1b1b1b]
Section title (h2):     text-[13px] font-semibold text-[#1b1b1b]
Card title:             text-[13px] font-medium text-[#1b1b1b]
Nav items:              text-[13px] font-medium
Body / table cells:     text-[13px] font-normal text-[#1b1b1b]
Muted / meta text:      text-[12px] text-[#4b5563]
Timestamps:             text-[12px] text-[#4b5563]
Section labels (caps):  text-[11px] uppercase tracking-widest text-[#555555]
Badge / tag:            text-[11px] font-medium
Stat value (large):     text-2xl font-semibold tracking-tight text-[#1b1b1b]
```

### Rules
- **Never** use `text-lg`, `text-xl`, `text-2xl` for body or nav text
- **Never** use `font-bold` on body — `font-medium` is the maximum
- `text-2xl` allowed only for stat values (large numbers in cards)
- Hierarchy via weight + color — not size

---

## COLOR TOKENS

### `src/app/globals.css` — full token map

```css
:root {
  /* ── Text ─────────────────────────────────────── */
  --color-text-primary:         #1b1b1b;
  --color-text-secondary:       #ffffff;
  --color-text-inverse:         #4b5563;
  --color-text-muted:           #999999;
  --color-text-disabled:        #c0c0c0;

  /* ── Surfaces ─────────────────────────────────── */
  --color-surface-base:         #000000;
  --color-surface-page:         #ffffff;
  --color-surface-muted:        #f9f9f9;
  --color-surface-subtle:       #f4f4f4;
  --color-surface-strong:       #ebe8e1;

  /* ── Border ───────────────────────────────────── */
  --color-border-default:       #e5e7eb;
  --color-border-strong:        #d1d5db;
  --color-border-dark:          #242424;

  /* ── Sidebar ──────────────────────────────────── */
  --color-sidebar-bg:           #000000;
  --color-sidebar-hover:        #1a1a1a;
  --color-sidebar-active:       #242424;
  --color-sidebar-border:       #242424;
  --color-sidebar-divider:      #242424;
  --color-sidebar-text:         #ffffff;
  --color-sidebar-muted:        #999999;
  --color-sidebar-label:        #555555;

  /* ── Focus ────────────────────────────────────── */
  --color-focus-ring:           rgba(34, 34, 34, 0.50);

  /* ── Status ───────────────────────────────────── */
  --color-success-bg:           #f0fdf4;
  --color-success-text:         #15803d;
  --color-success-border:       #bbf7d0;
  --color-warning-bg:           #fffbeb;
  --color-warning-text:         #b45309;
  --color-warning-border:       #fde68a;
  --color-danger-bg:            #fef2f2;
  --color-danger-text:          #dc2626;
  --color-danger-border:        #fecaca;

  /* ── shadcn variable overrides ────────────────── */
  --background:                 0 0% 100%;
  --foreground:                 0 0% 11%;
  --card:                       0 0% 100%;
  --card-foreground:            0 0% 11%;
  --popover:                    0 0% 100%;
  --popover-foreground:         0 0% 11%;
  --primary:                    0 0% 0%;
  --primary-foreground:         0 0% 100%;
  --secondary:                  36 19% 91%;
  --secondary-foreground:       0 0% 11%;
  --muted:                      0 0% 96%;
  --muted-foreground:           220 9% 46%;
  --accent:                     0 0% 96%;
  --accent-foreground:          0 0% 11%;
  --destructive:                0 72% 51%;
  --destructive-foreground:     0 0% 98%;
  --border:                     220 13% 91%;
  --input:                      220 13% 91%;
  --ring:                       0 0% 11%;
  --radius:                     0.5rem;

  /* ── Sidebar width ────────────────────────────── */
  --sidebar-width:              240px;
  --sidebar-collapsed-width:    56px;
  --sidebar-current-width:      240px;
}

.dark {
  --color-text-primary:         #f5f5f5;
  --color-text-secondary:       #1b1b1b;
  --color-text-inverse:         #a1a1aa;
  --color-surface-page:         #0a0a0a;
  --color-surface-muted:        #141414;
  --color-surface-subtle:       #1a1a1a;
  --color-border-default:       #242424;

  --background:                 0 0% 4%;
  --foreground:                 0 0% 98%;
  --card:                       0 0% 6%;
  --card-foreground:            0 0% 98%;
  --popover:                    0 0% 6%;
  --popover-foreground:         0 0% 98%;
  --primary:                    0 0% 98%;
  --primary-foreground:         0 0% 4%;
  --secondary:                  0 0% 12%;
  --secondary-foreground:       0 0% 98%;
  --muted:                      0 0% 10%;
  --muted-foreground:           0 0% 55%;
  --accent:                     0 0% 10%;
  --accent-foreground:          0 0% 98%;
  --border:                     0 0% 14%;
  --input:                      0 0% 14%;
  --ring:                       0 0% 85%;
}
```

---

## SPACING SCALE

| Token | Value | Usage |
|-------|-------|-------|
| `space.1` | `4px` | Icon gap, micro spacing |
| `space.2` | `6px` | Nav icon gap, badge padding-y |
| `space.3` | `8px` | Inner padding small |
| `space.4` | `10px` | Nav item padding-x |
| `space.5` | `12px` | Card padding small |

### Dashboard-specific sizing

```
Sidebar item height:       h-8 (32px)
Sidebar item padding:      px-[10px] py-[6px]
Sidebar section gap:       space-y-[4px]
Sidebar nav icon:          size-[15px]
Content area padding:      p-5 desktop / p-4 mobile
Card padding:              p-4
Stats grid gap:            gap-3
Section gap:               space-y-5
Table row height:          h-10 (40px)
Table cell padding:        px-3 py-2
Header height:             h-11 (44px)
Avatar size:               h-7 w-7 (feed) / h-8 w-8 (header)
Badge padding:             px-2 py-[2px]
Icon wrapper padding:      p-[6px]
Stat icon size:            size-[15px]
```

---

## RADIUS TOKENS

| Token | Value | Usage |
|-------|-------|-------|
| `radius.xs` | `8px` | Badges, tags, inputs, icon wrappers |
| `radius.sm` | `10px` | Buttons, nav items |
| `radius.md` | `14px` | Cards, dropdowns, modals |
| `radius.full` | `9999px` | Avatars, pills |

```
In Tailwind: rounded-[8px] / rounded-[10px] / rounded-[14px] / rounded-full
```

**Never use:** `rounded-xl`, `rounded-2xl`, `rounded-3xl`

---

## MOTION TOKENS

| Token | Value | Usage |
|-------|-------|-------|
| `motion.duration.instant` | `150ms ease` | Hover color changes, button states |
| `motion.duration.fast` | `200ms ease` | Sidebar collapse, dropdown open |
| `motion.duration.normal` | `300ms ease` | Page transitions, sheet open |

**All transitions MUST use one of these 3 values only.**

```css
/* Correct */
transition: background-color 150ms ease;
transition: width 200ms ease;

/* Wrong — never do this */
transition: all 100ms;
transition: opacity 250ms;
transition: transform 500ms;
```

---

## SHADOW & BORDER

```
Cards:         border border-[#e5e7eb] shadow-none
Inputs:        border border-[#e5e7eb] shadow-none
Sidebar:       border-r border-[#242424] shadow-none
Header:        border-b border-[#e5e7eb] shadow-none
Nav items:     no border, no shadow
Table:         no outer border — divide-y divide-[#e5e7eb] only

Dropdowns:     shadow-[0_4px_16px_rgba(0,0,0,0.08)] rounded-[14px]
Modals:        shadow-[0_8px_32px_rgba(0,0,0,0.12)] rounded-[14px]
Focus ring:    ring-2 ring-[rgba(34,34,34,0.5)] ring-offset-2
```

Only **dropdowns and modals** may have shadow. Everything else: shadow-none.

---

## SIDEBAR RULES

```
Background:    bg-black
Border right:  border-r border-[#242424]
Shadow:        none

Nav item default:  text-[#999999] text-[13px] rounded-[10px] px-[10px] py-[6px]
Nav item hover:    bg-[#1a1a1a] text-white — 150ms ease
Nav item active:   bg-[#242424] text-white font-medium

Section label:     text-[11px] text-[#555555] uppercase tracking-widest
                   px-[10px] mb-[4px] mt-4

Icon (default):    size-[15px] opacity-70
Icon (active):     size-[15px] opacity-100

Logo text:         text-[14px] font-semibold text-white
User area:         border-t border-[#242424] pt-3

Scrollbar hidden:
[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]
```

---

## STATE RULES

Every interactive element **must** define all 7 states:

| State | Rule |
|-------|------|
| `default` | Normal render — no modification |
| `hover` | `bg-[#ebe8e1]` light / `bg-[#1a1a1a]` dark — `duration-150` |
| `focus-visible` | `ring-2 ring-[rgba(34,34,34,0.5)] ring-offset-2` — never hidden |
| `active` | `opacity-90 scale-[0.99]` |
| `disabled` | `opacity-40 cursor-not-allowed pointer-events-none` |
| `loading` | Spinner visible, dimensions preserved, no layout shift |
| `error` | `border-red-500 text-red-600 focus-visible:ring-red-300` |

---

## COMPONENT QUICK REFERENCE

### Button
```
Default:   bg-[#1b1b1b] text-white text-[13px] font-medium rounded-[10px] px-4 py-2
Hover:     bg-[#333333] — duration-150
Ghost:     bg-transparent hover:bg-[#f4f4f4] text-[#1b1b1b]
Outline:   border border-[#e5e7eb] bg-white hover:bg-[#f9f9f9]
Danger:    bg-red-600 hover:bg-red-700 text-white
Size sm:   px-3 py-1.5 text-[12px]
```

### Badge / Status
```
Active:    bg-emerald-50 text-emerald-700 border border-emerald-200
Pending:   bg-amber-50   text-amber-700   border border-amber-200
Cancelled: bg-red-50     text-red-600     border border-red-200
Info:      bg-blue-50    text-blue-700    border border-blue-200
Neutral:   bg-[#f4f4f4]  text-[#4b5563]  border border-[#e5e7eb]
All:       text-[11px] font-medium rounded-[8px] px-2 py-[2px]
```

### Input
```
Default:   border border-[#e5e7eb] rounded-[8px] px-3 py-2 text-[13px]
           bg-white text-[#1b1b1b] placeholder:text-[#4b5563]
Focus:     border-[#1b1b1b] ring-2 ring-[rgba(34,34,34,0.15)]
Error:     border-red-500 focus:ring-red-200
```

### Card
```
border border-[#e5e7eb] rounded-[14px] p-4 bg-white shadow-none
Card title: text-[13px] font-semibold text-[#1b1b1b] mb-4
```

### Stat Card
```
Card wrapper same as above.
Title:  text-[12px] text-[#4b5563] font-medium uppercase tracking-wide
Value:  text-2xl font-semibold text-[#1b1b1b] tracking-tight mt-3
Change up:   text-[12px] text-emerald-600 flex items-center gap-[4px] mt-1
Change down: text-[12px] text-red-500 flex items-center gap-[4px] mt-1
Icon box:    p-[6px] bg-[#f4f4f4] rounded-[8px] size-[15px] text-[#1b1b1b]
```

### Table
```
No outer border.
divide-y divide-[#e5e7eb]
Header:  bg-[#f9f9f9] text-[12px] text-[#4b5563] uppercase tracking-wide font-medium px-3 py-2
Row:     text-[13px] text-[#1b1b1b] hover:bg-[#f9f9f9] transition-colors duration-150
Cell:    px-3 py-2
```

### Dropdown / Popover
```
bg-white border border-[#e5e7eb] rounded-[14px] p-1
shadow-[0_4px_16px_rgba(0,0,0,0.08)]
Item: text-[13px] rounded-[8px] px-3 py-2 hover:bg-[#f4f4f4] duration-150
```

---

## ANTI-PATTERNS

**Never do any of these:**

```
❌ text-lg / text-xl / text-2xl on body or nav
❌ font-bold on body text (font-medium is max)
❌ Hardcoded hex in .tsx files — use CSS variable references
❌ shadow-md / shadow-lg on cards, inputs, nav, sidebar
❌ rounded-xl / rounded-2xl — use token values (8/10/14px)
❌ Arbitrary transition durations (100ms, 250ms, 500ms)
❌ inline style={{ }} anywhere
❌ Background gradients or patterns on dashboard surfaces
❌ Low-contrast text (fails WCAG AA)
❌ Hidden focus indicators
❌ One-off spacing or typography exceptions
❌ Non-descriptive button labels ("Click here", "Submit")
```

---

## QA CHECKLIST

Run before considering any component done:

```
Typography
[ ] Font is Inter Variable, antialiased
[ ] All font sizes use token values: 11/12/13/14/15/16px only
[ ] No text-lg, text-xl, text-2xl on UI text
[ ] No font-bold on body — font-medium max

Colors
[ ] All colors reference CSS variables — no raw hex in .tsx files
[ ] Sidebar background is #000000
[ ] Page background is #ffffff (light) / #0a0a0a (dark)
[ ] Muted text is #4b5563 (light) / #a1a1aa (dark)
[ ] Status badges use correct token sets

Spacing & Radius
[ ] Nav item padding: px-[10px] py-[6px] exactly
[ ] Cards: rounded-[14px]
[ ] Buttons/nav: rounded-[10px]
[ ] Badges/inputs: rounded-[8px]
[ ] No rounded-xl or rounded-2xl

Shadow & Border
[ ] Cards: shadow-none border border-[#e5e7eb]
[ ] Sidebar: shadow-none border-r border-[#242424]
[ ] Only dropdowns/modals have shadow

Motion
[ ] Hover: 150ms ease
[ ] Sidebar/dropdown: 200ms ease
[ ] No other durations used

States
[ ] All 7 states defined for every interactive component
[ ] focus-visible ring visible on keyboard navigation
[ ] Disabled: opacity-40 cursor-not-allowed
[ ] Loading: spinner, no layout shift

Code quality
[ ] "use client" only where necessary
[ ] Zero TypeScript errors
[ ] Zero ESLint warnings
[ ] No inline style={{}}
[ ] pnpm only
```
