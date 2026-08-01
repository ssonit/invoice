# Billing Mode

`BILLING_MODE` env var controls how the billing system behaves. Three modes:

| Mode | Value | Behavior |
|------|-------|----------|
| **None** | `"none"` | Billing completely disabled — no checkout, no webhook, no quota, no feature gate. `getTeamAccess()` always returns `{ allowed: true, reason: "billing_disabled" }`. `checkStarterQuota()` always `{ allowed: true }`. |
| **Test** | `"test"` | Test billing with Lemon Squeezy test mode keys. All gates/quotas work normally. UI shows amber "Test mode" badge. `BILLING_DEV_UNLOCK` still works as a convenience bypass in non-prod. |
| **Live** | `"live"` | Production billing (default when unset or unrecognized). Full gate/quota enforcement. `BILLING_DEV_UNLOCK` blocked in production (`VERCEL_ENV=production` or `NODE_ENV=production`). |

## How it works

```
BILLING_MODE env → getBillingMode() → gates at every billing touchpoint
```

`getBillingMode()` in `src/lib/billing.ts` reads the env var. Defaults to `"live"` for safety — an unrecognized value falls back to the strictest mode.

Every billing-sensitive code path checks the mode first:

| Call site | Mode check | Effect when `none` |
|-----------|-----------|---------------------|
| `getTeamAccess()` | `src/lib/billing/access.ts` | Skips DB, returns allowed |
| `checkStarterQuota()` | `src/lib/billing/usage.ts` | Skips DB + count, returns allowed |
| `createCheckoutUrl()` | `src/app/dashboard/actions.ts` | Returns error, no checkout created |
| Lemon Squeezy webhook | `src/app/api/webhooks/lemonsqueezy/route.ts` | Returns `ignored` immediately |
| Billing settings UI | `src/app/dashboard/settings/billing-card.tsx` | Shows "Billing is disabled", hides upgrade/manage |

## Setup

```sh
# .env.local
BILLING_MODE=test    # or "none" / "live"
```

`BILLING_DEV_UNLOCK` is orthogonal — it's a convenience bypass that still works in `test` mode. See `src/constants/billing.ts` for the `BILLING_MODE` constant definitions.

## Related

- [`billing-lemonsqueezy.md`](billing-lemonsqueezy.md) — full Lemon Squeezy integration architecture
- [`src/lib/billing.ts`](../src/lib/billing.ts) — `getBillingMode()`, `TeamAccess`, `isBillingDevUnlockEnabled()`
