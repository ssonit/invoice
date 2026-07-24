---
description: What gets unit-tested vs. manually verified, and when to run what
---

# Testing conventions

**Unit test (Vitest) all pure `src/lib/` logic** — this is the primary automated test
layer in this project. Ship a `.test.ts` alongside new logic, not as a follow-up.

**What to test:** validation schemas (valid + invalid inputs, boundary values), business
logic (date/aggregation math, formatting, classification) — favor edge cases over
happy-path-only coverage.

**What's deliberately *not* unit-tested** (established convention, not an oversight): API
routes, Server Actions, `src/trigger/*.ts` background tasks, UI components, and thin
LLM-SDK wrappers (`extraction/{anthropic,google,deepseek}.ts`) — these mix I/O with logic
and get verified manually instead, using the in-app browser tools against the local dev
server + local Supabase (and, for background tasks, `npx trigger.dev@latest dev` running
alongside).

**Before any commit touching `src/lib/`:** `npm run test` and `npx tsc --noEmit`.

**Before calling a feature done:** `npm run build`, plus an actual manual smoke test of
the user-facing flow in-browser — DOM/screenshot checks aren't a substitute for clicking
through the real thing when the change is UI-observable.
