# Vendors Toolbar Lint Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the two confirmed ESLint `react-hooks` errors in `vendors-toolbar.tsx` — a pre-existing bug (predates this session's work), same pattern already fixed twice this session in `invoices-toolbar.tsx` and `inbox-view.tsx`.

**Architecture:** No behavior change. Apply the identical, already-proven fix: move the ref write into its own `useEffect`, and replace the `useEffect` that mirrors `query.q` into local `q` state with React's "adjust state during render" pattern (track a previous-value state, compare and adjust in the render body, not an Effect).

**Tech Stack:** React 19, no new dependencies.

---

## Task 1: Fix the ref-write-during-render and setState-in-effect anti-patterns

**Files:**
- Modify: `src/components/dashboard/vendors/vendors-toolbar.tsx`

- [ ] **Step 1: Confirm the current lint failures**

Run: `npx eslint src/components/dashboard/vendors/vendors-toolbar.tsx`
Expected: 2 errors — `react-hooks/refs` ("Cannot update ref during render") on the
`queryRef.current = query` line, and `react-hooks/set-state-in-effect` ("Avoid calling
setState() directly within an effect") on `setQ(query.q)` inside the first `useEffect`.

- [ ] **Step 2: Apply the fix**

Change:
```tsx
  const [isPending, startTransition] = useTransition()
  const [q, setQ] = useState(query.q)
  const queryRef = useRef(query)
  queryRef.current = query

  useEffect(() => {
    setQ(query.q)
  }, [query.q])
```
to:
```tsx
  const [isPending, startTransition] = useTransition()
  const [q, setQ] = useState(query.q)
  const [prevQueryQ, setPrevQueryQ] = useState(query.q)

  // Sync the search box when the URL's q changes from outside this component
  // (browser back/forward). Adjusted during render, per React's guidance,
  // rather than in an Effect.
  if (query.q !== prevQueryQ) {
    setPrevQueryQ(query.q)
    setQ(query.q)
  }

  const queryRef = useRef(query)
  useEffect(() => {
    queryRef.current = query
  }, [query])
```

This is the exact pattern already applied to `invoices-toolbar.tsx` (commit `f96a4d6`) and
`inbox-view.tsx`'s search-sync effect (commit `a396dd8`) — no new design decision, just
consistency.

- [ ] **Step 3: Verify the fix**

Run: `npx eslint src/components/dashboard/vendors/vendors-toolbar.tsx`
Expected: 0 errors.

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual smoke test**

Prerequisite: local Supabase + dev server running, logged in as the seeded admin.

1. Open `/dashboard/vendors`.
2. Type into the search box → after the debounce, the URL updates to `?q=...` and results
   narrow — confirms the debounced search still works post-fix.
3. Use the browser's Back button after a search → the search box should reflect the
   previous URL's `q` value (this is exactly the "sync from outside" behavior the
   render-time adjustment preserves).
4. Change the filter/sort dropdowns → still update the URL and results as before.

- [ ] **Step 5: Run the full test suite**

Run: `npm run test`
Expected: all suites pass (no test covers this component directly — Server
Actions/Client Components are manually verified per project convention — but this
confirms nothing else broke).

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/vendors/vendors-toolbar.tsx
git commit -m "fix: move ref write and query-sync out of render/effect anti-pattern in vendors-toolbar.tsx"
```

---

## File Structure Summary

**Modified:**
- `src/components/dashboard/vendors/vendors-toolbar.tsx`
