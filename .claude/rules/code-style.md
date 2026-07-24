---
description: General file organization, naming, and abstraction conventions
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

**Naming:** kebab-case file names, PascalCase components, camelCase functions/variables.

**Reuse before you write:** check for an existing `lib/` helper before adding a new one —
e.g. `escapeIlike`, `normalizeVendorKey`, `parsePageParam` already exist and are tested;
don't duplicate their logic inline.
