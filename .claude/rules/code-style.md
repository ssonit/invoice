---
description: General file organization and clean-code conventions
---

# Code style

**File organization:** pure, side-effect-light logic lives in `src/lib/` — this is what
gets unit-tested (see `.claude/rules/testing.md`). Orchestration (API routes, Server
Actions, pages) stays thin and calls into `lib/`.

**Swappable-backend abstraction:** a provider selected at runtime (e.g. LLM extraction:
anthropic/google/deepseek) is chosen via an env var through a dispatch table
(`src/lib/extraction/index.ts`), never hardcoded inline at the call site. Apply the same
pattern to any future swappable-backend feature — don't couple calling code to one
specific vendor/model.

**Naming:** see `.claude/rules/naming.md`.

**Reuse before you write:** check for an existing `lib/` helper before adding a new one —
e.g. `escapeIlike`, `normalizeVendorKey`, `parsePageParam` already exist and are tested;
don't duplicate their logic inline.

**No magic numbers/strings** — name them in `src/constants/` (see
`.claude/rules/constants.md`) rather than repeating a bare literal across the codebase.

**Function parameters:** beyond 2–3 positional parameters, switch to a single options
object — easier to call correctly, easier to extend without breaking every call site. This
is already the pattern for any non-trivial internal function here, e.g.
`processExtraction({ supabase, userId, messageId, sourceRef, input, fileBuffer, fileName })`
rather than seven positional arguments.

**Prefer early return over nested conditionals.** Guard clauses at the top of a function
(`if (!user) redirect("/login");`) instead of wrapping the rest of the function body in an
`if (user) { ... }` — matches the pattern already used throughout Server Actions and
routes here, and keeps nesting shallow.

**One clear responsibility per function.** If a function's name needs "and" to describe
what it does, it's probably two functions — see how extraction was split into
`processExtraction` (save one item) called in a loop from the orchestrating task, rather
than one function looping and saving inline.
