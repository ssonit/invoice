---
description: shadcn/ui customization and design token rules
paths:
  - "src/components/**"
---

# Component conventions

shadcn/ui primitives live in `src/components/ui/`, customized — re-running
`npx shadcn add <name>` must not silently overwrite them. Use `yes N | npx shadcn add ...`
or review the diff before accepting any regeneration.

Dark-mode-only design tokens, lime accent (`#E8FF47`), Outfit display font — full details
in [`docs/DESIGN-SYSTEM.md`](../../docs/DESIGN-SYSTEM.md) and
[`docs/DASHBOARD.md`](../../docs/DASHBOARD.md). Don't introduce new one-off colors/fonts
outside those tokens without checking there first.
