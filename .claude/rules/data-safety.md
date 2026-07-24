---
description: Never physically delete user data
---

# Data safety

Never physically delete user data — rows, accounts, files, or otherwise — without the
user explicitly asking for it in that exact instance. Default to additive migrations and
soft delete (a `deleted_at`/status flag, e.g. `profiles.deleted_at`) instead of
`DROP`/`DELETE`/`auth.admin.deleteUser`.

This applies even when a "Delete X" feature is the explicit user-facing request — the
feature can still delete/hide the record from the user's view via a status flag without
physically removing the row. If a task genuinely requires physical deletion, stop and ask
first; don't assume a "Delete" button implies `DELETE FROM`.
