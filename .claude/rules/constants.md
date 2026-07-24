---
description: Where constants live and how they're shaped
paths:
  - "src/constants/**"
---

# Constants conventions

No magic numbers or magic strings inline in logic or JSX — name them. This is
established practice here (`src/constants/{vendors,inbox,subscriptions}.ts`) and matches
standard TypeScript guidance (declare an unnamed literal as a capitalized named constant
instead of repeating it).

**One file per domain** in `src/constants/` (`vendors.ts`, `inbox.ts`, `subscriptions.ts`
— add a new file for a new domain rather than growing an unrelated one).

**Shape, exactly as already established — don't invent a variant:**
```ts
export const THING_FILTER = {
  ALL: "all",
  SOME_CASE: "some_case",
} as const;

export type ThingFilter = (typeof THING_FILTER)[keyof typeof THING_FILTER];

export const THING_FILTER_OPTIONS: ReadonlyArray<{ value: ThingFilter; label: string }> = [
  { value: THING_FILTER.ALL, label: "All things" },
  { value: THING_FILTER.SOME_CASE, label: "Some case" },
];

// Derive the label lookup FROM the options array — don't hand-maintain a second mapping
// that can drift out of sync with it.
export const THING_FILTER_LABELS: Record<ThingFilter, string> = Object.fromEntries(
  THING_FILTER_OPTIONS.map((o) => [o.value, o.label]),
) as Record<ThingFilter, string>;

export const THING_DEFAULT_FILTER = THING_FILTER.ALL;
```

Numeric/timing constants (debounce ms, page size, max length) live here too, not inline —
see `VENDOR_SEARCH_DEBOUNCE_MS`, `VENDOR_LIST_PAGE_SIZE`, `VENDOR_SEARCH_MAX_LENGTH` for
the pattern. A small, single-use, self-evident number in a test fixture (e.g. `pageSize:
20` in a one-off test call) doesn't need this — this is for values referenced by
production logic, especially anywhere the same number must stay in sync across two or
more places.
