---
description: Server Action conventions
paths:
  - "src/app/**/actions.ts"
---

# Server Action conventions

Co-locate `actions.ts` next to the route segment that uses it
(`src/app/dashboard/actions.ts`, `src/app/dashboard/vendors/actions.ts`, etc.), marked
`"use server"`.

Return typed result objects for the client to react to —
`{ ok: true, ... } | { ok: false, error: string }` — rather than throwing. Use `redirect()`
only for actions that always navigate away on success (login, signup, password reset,
logout). Validate input through `src/lib/validation/*.ts` before touching the database;
never trust a client-side enable/disable check alone for a destructive or sensitive action
— re-verify server-side (see `.claude/rules/data-safety.md` for the deletion case).
