---
description: Zod validation module conventions
paths:
  - "src/lib/validation/**"
---

# Validation conventions

One file per domain (`auth.ts`, `upload.ts`, `vendors.ts`, `subscriptions.ts`). Every
parser returns the same discriminated union — don't invent a new result shape:

```ts
type ValidationResult<T> = { success: true; data: T } | { success: false; error: string };
```

Naming: `parseXInput(input: unknown)` for structured data, `parseXForm(formData: FormData)`
for Server Action form submissions. Always ship a `.test.ts` alongside a new schema,
covering valid input, each rejection case, and trim/transform behavior — not just the
happy path.
