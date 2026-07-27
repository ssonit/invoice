# Lemon Squeezy Billing Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users pay for the Team plan via Lemon Squeezy — hosted checkout, signed webhook, and a Settings billing card. No feature gating in this pass (see design spec for why).

**Architecture:** A new `billing_subscriptions` table (1:1 with `profiles`) holds webhook-driven subscription state, written only by the service-role client after HMAC verification. Every Lemon Squeezy `subscription_*` webhook event carries the full current state, so the handler always upserts rather than branching per event type. `hasActiveTeamPlan()` is a pure, unit-tested helper — used today only by the Settings billing card, ready for future gating.

**Tech Stack:** Next.js 16 Server Actions + Route Handler, Supabase (Postgres + RLS), Lemon Squeezy REST API (plain `fetch`, no SDK dependency), Node `crypto` for HMAC verification, Vitest.

**Design spec:** `docs/superpowers/specs/2026-07-25-billing-lemonsqueezy-design.md`

**Deviation from spec:** the spec's file list put `createCheckoutUrl()` (I/O) and
`verifyWebhookSignature()` (pure) in one `src/lib/lemonsqueezy.ts`. This plan splits them
into `src/lib/lemonsqueezy.ts` (I/O, `import "server-only"`, not unit-tested) and
`src/lib/lemonsqueezy-webhook.ts` (pure, unit-tested) — same reasoning as this repo's
existing `agentmail.ts` (I/O) / `email-reply-templates.ts` (pure) split, and keeps the
tested module free of a `server-only` import.

---

## Task 1: Migration — `billing_subscriptions` table + extend `handle_new_user()`

**Files:**
- Create: `supabase/migrations/20260725150000_billing_subscriptions.sql`

- [x] **Step 1: Write the migration**

```sql
-- Payment/subscription state for the app's own billing (Lemon Squeezy), one
-- row per user. Distinct from subscription_confirmations, which tracks
-- detected *vendor* recurring charges — an unrelated domain that happens to
-- share the word "subscription".
create table public.billing_subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'starter' check (plan in ('starter', 'team')),
  status text not null default 'none'
    check (status in ('none', 'on_trial', 'active', 'paused', 'past_due', 'unpaid', 'cancelled', 'expired')),
  ls_customer_id text,
  ls_subscription_id text unique,
  customer_portal_url text,
  renews_at timestamptz,
  ends_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.billing_subscriptions enable row level security;

create policy "Users can view their own billing subscription"
  on public.billing_subscriptions for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- No insert/update/delete policy for authenticated: a user can read their own
-- row but never write it directly. Only the webhook (via service_role, after
-- HMAC verification) ever mutates billing state.
grant select on table public.billing_subscriptions to authenticated;
grant select, insert, update, delete on table public.billing_subscriptions to service_role;

-- Extend the existing profile-creation trigger so every new user also gets a
-- default billing_subscriptions row — no code needs to null-check a missing one.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);

  insert into public.billing_subscriptions (user_id)
  values (new.id);

  return new;
end;
$$;
```

- [x] **Step 2: Apply and verify**

Prerequisite: Docker Desktop running.

Run:
```bash
npx supabase db reset
```
Expected: reset completes cleanly.

Run:
```bash
npx supabase db query "select user_id, plan, status from billing_subscriptions where user_id = '00000000-0000-0000-0000-000000000001'"
```
Expected: one row for the seeded admin user, `plan = 'starter'`, `status = 'none'` (proves the extended trigger ran during seed).

Run:
```bash
npx supabase db query "select grantee, privilege_type from information_schema.role_table_grants where table_name = 'billing_subscriptions'"
```
Expected: `authenticated` has `SELECT` only; `service_role` has `SELECT`, `INSERT`, `UPDATE`, `DELETE`.

- [x] **Step 3: Commit**

```bash
git add supabase/migrations/20260725150000_billing_subscriptions.sql
git commit -m "feat: add billing_subscriptions table for Lemon Squeezy billing"
```

---

## Task 2: `hasActiveTeamPlan()` — pure gating helper

**Files:**
- Create: `src/lib/billing.ts`
- Test: `src/lib/billing.test.ts`

- [x] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { hasActiveTeamPlan } from "./billing";

describe("hasActiveTeamPlan", () => {
  it("returns false for no subscription row", () => {
    expect(hasActiveTeamPlan(null)).toBe(false);
  });

  it("returns false for status 'none'", () => {
    expect(hasActiveTeamPlan({ status: "none", ends_at: null })).toBe(false);
  });

  it.each(["active", "on_trial", "past_due"] as const)(
    "returns true for status '%s'",
    (status) => {
      expect(hasActiveTeamPlan({ status, ends_at: null })).toBe(true);
    },
  );

  it("returns true when cancelled but ends_at is in the future", () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
    expect(hasActiveTeamPlan({ status: "cancelled", ends_at: future })).toBe(true);
  });

  it("returns false when cancelled and ends_at is in the past", () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();
    expect(hasActiveTeamPlan({ status: "cancelled", ends_at: past })).toBe(false);
  });

  it("returns false when cancelled with no ends_at", () => {
    expect(hasActiveTeamPlan({ status: "cancelled", ends_at: null })).toBe(false);
  });

  it.each(["paused", "unpaid", "expired"] as const)(
    "returns false for status '%s'",
    (status) => {
      expect(hasActiveTeamPlan({ status, ends_at: null })).toBe(false);
    },
  );
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/billing.test.ts`
Expected: FAIL — `Cannot find module './billing'`.

- [x] **Step 3: Write the implementation**

```ts
export type BillingSubscriptionStatus =
  | "none"
  | "on_trial"
  | "active"
  | "paused"
  | "past_due"
  | "unpaid"
  | "cancelled"
  | "expired";

export type BillingSubscriptionRow = {
  plan: "starter" | "team";
  status: BillingSubscriptionStatus;
  customer_portal_url: string | null;
  renews_at: string | null;
  ends_at: string | null;
};

const ACCESS_GRANTING_STATUSES = new Set<BillingSubscriptionStatus>([
  "active",
  "on_trial",
  "past_due",
]);

/**
 * True if the user currently has Team-plan access. A cancelled subscription
 * still grants access until `ends_at` — the user already paid for that
 * period. Not called from any gated route yet (see design spec's "no feature
 * gating in this pass"); used today only by the Settings billing card.
 */
export function hasActiveTeamPlan(
  row: Pick<BillingSubscriptionRow, "status" | "ends_at"> | null,
): boolean {
  if (!row) return false;
  if (ACCESS_GRANTING_STATUSES.has(row.status)) return true;
  if (row.status === "cancelled" && row.ends_at) {
    return new Date(row.ends_at) > new Date();
  }
  return false;
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/billing.test.ts`
Expected: PASS, 11 tests. (Correction: this doc originally said 10 — miscounted; `it.each` with 3 statuses × 2 blocks + 5 standalone `it`s = 11.)

- [x] **Step 5: Commit**

```bash
git add src/lib/billing.ts src/lib/billing.test.ts
git commit -m "feat: add hasActiveTeamPlan billing gating helper"
```

---

## Task 3: `verifyWebhookSignature()` — pure HMAC verification

**Files:**
- Create: `src/lib/lemonsqueezy-webhook.ts`
- Test: `src/lib/lemonsqueezy-webhook.test.ts`

- [x] **Step 1: Write the failing test**

```ts
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyWebhookSignature } from "./lemonsqueezy-webhook";

const SECRET = "test-webhook-secret";

function signBody(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

describe("verifyWebhookSignature", () => {
  it("returns true for a correctly signed payload", () => {
    const body = JSON.stringify({ meta: { event_name: "subscription_created" } });
    const signature = signBody(body, SECRET);
    expect(verifyWebhookSignature(body, signature, SECRET)).toBe(true);
  });

  it("returns false for a tampered payload", () => {
    const body = JSON.stringify({ meta: { event_name: "subscription_created" } });
    const signature = signBody(body, SECRET);
    const tamperedBody = JSON.stringify({ meta: { event_name: "subscription_cancelled" } });
    expect(verifyWebhookSignature(tamperedBody, signature, SECRET)).toBe(false);
  });

  it("returns false for a signature signed with the wrong secret", () => {
    const body = JSON.stringify({ meta: { event_name: "subscription_created" } });
    const signature = signBody(body, "wrong-secret");
    expect(verifyWebhookSignature(body, signature, SECRET)).toBe(false);
  });

  it("returns false for a missing signature header", () => {
    const body = JSON.stringify({ meta: { event_name: "subscription_created" } });
    expect(verifyWebhookSignature(body, null, SECRET)).toBe(false);
  });

  it("returns false for a malformed (non-hex) signature header", () => {
    const body = JSON.stringify({ meta: { event_name: "subscription_created" } });
    expect(verifyWebhookSignature(body, "not-a-valid-signature", SECRET)).toBe(false);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/lemonsqueezy-webhook.test.ts`
Expected: FAIL — `Cannot find module './lemonsqueezy-webhook'`.

- [x] **Step 3: Write the implementation**

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Lemon Squeezy signs each webhook body with HMAC-SHA256 using the store's
 * webhook signing secret, sent as a hex digest in the `X-Signature` header.
 * Verified with a timing-safe comparison (matches the intent of the `svix`
 * library already used for the AgentMail webhook, hand-rolled here since
 * Lemon Squeezy doesn't use svix).
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader) return false;

  const expected = Buffer.from(createHmac("sha256", secret).update(rawBody).digest("hex"), "utf8");
  const actual = Buffer.from(signatureHeader, "utf8");

  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/lemonsqueezy-webhook.test.ts`
Expected: PASS, 5 tests.

- [x] **Step 5: Commit**

```bash
git add src/lib/lemonsqueezy-webhook.ts src/lib/lemonsqueezy-webhook.test.ts
git commit -m "feat: add Lemon Squeezy webhook signature verification"
```

---

## Task 4: `createLemonSqueezyCheckout()` — checkout API client

**Files:**
- Create: `src/lib/lemonsqueezy.ts`
- Modify: `.env.local.example`

- [x] **Step 1: Add env vars**

Append to `.env.local.example`:
```
# Lemon Squeezy (billing — Merchant of Record)
# Store/variant IDs come from the Lemon Squeezy dashboard; API key from
# Settings → API. Webhook secret is set when creating the webhook endpoint
# (Settings → Webhooks), pointing at /api/webhooks/lemonsqueezy.
LEMONSQUEEZY_API_KEY=
LEMONSQUEEZY_STORE_ID=
LEMONSQUEEZY_TEAM_VARIANT_ID=
LEMONSQUEEZY_WEBHOOK_SECRET=
```

- [x] **Step 2: Write `createLemonSqueezyCheckout()`** (code review found the failure branch discarded the response body; fixed in a follow-up commit `cc413eb` — see file for current state)

```ts
import "server-only";

// Thin wrapper around Lemon Squeezy's JSON:API checkout endpoint — no SDK
// dependency, this is the only call this app makes against their API.
export async function createLemonSqueezyCheckout({
  userId,
  email,
  redirectUrl,
}: {
  userId: string;
  email: string;
  redirectUrl: string;
}): Promise<string> {
  const response = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
    method: "POST",
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`,
    },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          checkout_data: {
            email,
            custom: { user_id: userId },
          },
          product_options: {
            redirect_url: redirectUrl,
          },
        },
        relationships: {
          store: {
            data: { type: "stores", id: process.env.LEMONSQUEEZY_STORE_ID },
          },
          variant: {
            data: { type: "variants", id: process.env.LEMONSQUEEZY_TEAM_VARIANT_ID },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Lemon Squeezy checkout request failed: ${response.status}`);
  }

  const json = (await response.json()) as { data: { attributes: { url: string } } };
  return json.data.attributes.url;
}
```

- [x] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [x] **Step 4: Commit**

```bash
git add src/lib/lemonsqueezy.ts .env.local.example
git commit -m "feat: add Lemon Squeezy checkout API client"
```

---

## Task 5: Webhook route

**Files:**
- Create: `src/app/api/webhooks/lemonsqueezy/route.ts`

- [x] **Step 1: Write the route** (code review found an unhandled crash if `LEMONSQUEEZY_WEBHOOK_SECRET` is unset; fixed in follow-up commit `ec433ac` with an explicit guard before signature verification — see file for current state)

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyWebhookSignature } from "@/lib/lemonsqueezy-webhook";
import type { BillingSubscriptionStatus } from "@/lib/billing";

type LemonSqueezySubscriptionEvent = {
  meta: {
    event_name: string;
    custom_data?: { user_id?: string };
  };
  data: {
    id: string;
    attributes: {
      status: BillingSubscriptionStatus;
      customer_id: number;
      renews_at: string | null;
      ends_at: string | null;
      urls: { customer_portal: string };
    };
  };
};

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-signature");

  if (!verifyWebhookSignature(rawBody, signature, process.env.LEMONSQUEEZY_WEBHOOK_SECRET!)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(rawBody) as LemonSqueezySubscriptionEvent;

  if (!event.meta.event_name.startsWith("subscription_")) {
    return NextResponse.json({ status: "ignored" });
  }

  const userId = event.meta.custom_data?.user_id;
  if (!userId) {
    // Unmappable event (missing/stale custom_data) — ack so Lemon Squeezy
    // doesn't retry an event we can never apply, but log for investigation.
    console.error("Lemon Squeezy webhook missing user_id in custom_data", event.data.id);
    return NextResponse.json({ status: "ignored" });
  }

  const service = createServiceClient();
  const { error } = await service.from("billing_subscriptions").upsert(
    {
      user_id: userId,
      plan: "team",
      status: event.data.attributes.status,
      ls_customer_id: String(event.data.attributes.customer_id),
      ls_subscription_id: event.data.id,
      customer_portal_url: event.data.attributes.urls.customer_portal,
      renews_at: event.data.attributes.renews_at,
      ends_at: event.data.attributes.ends_at,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("Failed to save billing subscription", userId, error);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
}
```

- [x] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [x] **Step 3: Commit**

```bash
git add src/app/api/webhooks/lemonsqueezy/route.ts
git commit -m "feat: add Lemon Squeezy webhook handler"
```

---

## Task 6: Checkout Server Action + Settings billing card

**Files:**
- Modify: `src/app/dashboard/actions.ts`
- Create: `src/app/dashboard/settings/billing-card.tsx`
- Modify: `src/app/dashboard/settings/page.tsx`

- [x] **Step 1: Add `createCheckoutUrl()` to `src/app/dashboard/actions.ts`**

Add this import alongside the existing ones at the top of the file:
```ts
import { headers } from "next/headers";
import { createLemonSqueezyCheckout } from "@/lib/lemonsqueezy";
```

Append to the end of the file:
```ts
export type CreateCheckoutUrlResult = { ok: true; url: string } | { ok: false; error: string };

// Starts a Lemon Squeezy hosted checkout for the Team plan. Card data never
// touches this server — the user completes payment on Lemon Squeezy's page.
export async function createCheckoutUrl(): Promise<CreateCheckoutUrlResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const origin = (await headers()).get("origin");

  try {
    const url = await createLemonSqueezyCheckout({
      userId: user.id,
      email: user.email!,
      redirectUrl: `${origin}/dashboard/settings?checkout=success`,
    });
    return { ok: true, url };
  } catch (err) {
    console.error("Failed to create checkout", user.id, err);
    return { ok: false, error: "Could not start checkout. Please try again." };
  }
}
```

- [x] **Step 2: Write `BillingCard`** (code review found `paused`/`unpaid` subscribers were routed to a duplicate-checkout button instead of their existing portal; fixed in follow-up commit `119813e` — the CTA now uses a separate `hasExistingSubscription` check, decoupled from `isTeam`. See file for current state.)

```tsx
"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { createCheckoutUrl } from "@/app/dashboard/actions";
import { hasActiveTeamPlan, type BillingSubscriptionRow } from "@/lib/billing";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatInvoiceDate } from "@/lib/invoices";

export function BillingCard({ subscription }: { subscription: BillingSubscriptionRow }) {
  const [isPending, startTransition] = useTransition();
  const isTeam = hasActiveTeamPlan(subscription);

  function handleUpgrade() {
    startTransition(async () => {
      const result = await createCheckoutUrl();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      window.location.href = result.url;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[13px] text-muted-foreground">
          {isTeam ? "You're on the Team plan." : "You're on the free Starter plan."}
        </p>
        {subscription.status === "past_due" ? (
          <Badge variant="destructive">Payment failed — please update your card</Badge>
        ) : null}
        {subscription.status === "cancelled" && subscription.ends_at ? (
          <Badge variant="secondary">Ends {formatInvoiceDate(subscription.ends_at)}</Badge>
        ) : null}
      </div>

      {isTeam ? (
        // Button wraps @base-ui/react/button, which uses a `render` prop for
        // polymorphism, not Radix's `asChild` — a plain anchor styled with
        // buttonVariants() avoids depending on that (untested here) merge
        // behavior for something this simple.
        <a
          href={subscription.customer_portal_url ?? "#"}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({ variant: "outline", size: "sm", className: "w-fit" })}
        >
          Manage subscription
        </a>
      ) : (
        <Button size="sm" className="w-fit" disabled={isPending} onClick={handleUpgrade}>
          {isPending ? <Spinner data-icon="inline-start" /> : null}
          {isPending ? "Redirecting..." : "Upgrade to Team"}
        </Button>
      )}
    </div>
  );
}
```

- [x] **Step 3: Wire into `src/app/dashboard/settings/page.tsx`** (code review found the `billing_subscriptions` query's error was silently discarded; fixed in follow-up commit `119813e` to log it server-side)

Add this import alongside the existing ones:
```ts
import { BillingCard } from "./billing-card";
import type { BillingSubscriptionRow } from "@/lib/billing";
```

Change:
```ts
  const { data: inbox } = await supabase
    .from("inboxes")
    .select("email_address")
    .eq("user_id", user!.id)
    .maybeSingle();
```
to:
```ts
  const [{ data: inbox }, { data: subscription }] = await Promise.all([
    supabase.from("inboxes").select("email_address").eq("user_id", user!.id).maybeSingle(),
    supabase
      .from("billing_subscriptions")
      .select("plan, status, customer_portal_url, renews_at, ends_at")
      .eq("user_id", user!.id)
      .single<BillingSubscriptionRow>(),
  ]);
```

Add a new card between the "Forwarding address" card and the "Password" card:
```tsx
        <Card className="rounded-[14px] shadow-none">
          <CardHeader>
            <CardTitle className="text-[13px] font-semibold">Billing</CardTitle>
            <CardDescription className="text-[13px]">
              Manage your plan and payment method.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {subscription ? (
              <BillingCard subscription={subscription} />
            ) : (
              <p className="text-[13px] text-muted-foreground">
                Could not load your billing status. Please refresh the page.
              </p>
            )}
          </CardContent>
        </Card>
```

- [x] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [x] **Step 5: Commit**

```bash
git add src/app/dashboard/actions.ts src/app/dashboard/settings/billing-card.tsx src/app/dashboard/settings/page.tsx
git commit -m "feat: add checkout action and Settings billing card"
```

---

## Task 7: Trim landing page copy to match what's real

**Files:**
- Modify: `src/lib/landing/dictionary.ts`

- [x] **Step 1: Trim the English Team plan features**

Change (around line 186-192):
```ts
          features: [
            "Everything in Starter",
            "Shared workspace",
            "Trend charts",
            "Export-ready rows",
            "Priority parsing",
          ],
```
to:
```ts
          features: [
            "Everything in Starter",
            "Trend charts",
            "Export-ready rows",
          ],
```

- [x] **Step 2: Trim the Vietnamese Team plan features**

Change (around line 330-336):
```ts
          features: [
            "Mọi thứ trong Starter",
            "Workspace dùng chung",
            "Biểu đồ xu hướng",
            "Xuất dữ liệu sẵn sàng",
            "Ưu tiên xử lý",
          ],
```
to:
```ts
          features: [
            "Mọi thứ trong Starter",
            "Biểu đồ xu hướng",
            "Xuất dữ liệu sẵn sàng",
          ],
```

- [x] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [x] **Step 4: Commit**

```bash
git add src/lib/landing/dictionary.ts
git commit -m "fix: trim landing Team plan copy to features that actually exist"
```

---

## Task 8: Full verification + docs

**Files:**
- Modify: `docs/third-party-services.md`
- Create: `docs/billing-lemonsqueezy.md`

- [x] **Step 1: Run the whole test suite**

Run: `npm run test`
Expected: all suites pass, including the two new ones (`billing.test.ts`, `lemonsqueezy-webhook.test.ts`).

- [x] **Step 2: Type-check and production build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed.

- [x] **Step 3: Add a Lemon Squeezy section to `docs/third-party-services.md`**

Append:
```markdown

## Lemon Squeezy (billing)

- Merchant of Record — Lemon Squeezy is the seller of record and handles global
  VAT/sales-tax compliance. Fee: ~5% + 50¢ per transaction.
- One paid variant (Team, $29/mo). Store/variant IDs and API key come from the
  Lemon Squeezy dashboard; set in `.env.local` (`LEMONSQUEEZY_API_KEY`,
  `LEMONSQUEEZY_STORE_ID`, `LEMONSQUEEZY_TEAM_VARIANT_ID`,
  `LEMONSQUEEZY_WEBHOOK_SECRET`).
- **Test mode**: Lemon Squeezy stores support a test mode that runs the full
  checkout/webhook flow without a real charge — use it for local dev and the
  manual verification below instead of a real card.
- Webhook endpoint: configure `https://<your-domain>/api/webhooks/lemonsqueezy`
  in the store's Settings → Webhooks, subscribed to `subscription_*` events.
  For local dev, use a tunnel (e.g. `ngrok http 3000`) and point the webhook
  at the tunnel URL.
- Architecture details: [`docs/billing-lemonsqueezy.md`](billing-lemonsqueezy.md).
```

- [ ] **Step 4: Manual smoke test** (NOT yet run — needs a real Lemon Squeezy test-mode store, webhook tunnel, and `.env.local` values that don't exist in this environment. Genuine outstanding to-do before this is launch-ready — see `docs/billing-lemonsqueezy.md`'s "Manual verification still needed" section.)

Prerequisite: Lemon Squeezy test-mode store configured with a Team variant, webhook
pointed at a local tunnel, `.env.local` filled in, dev server running.

1. Sign in, go to `/dashboard/settings` → Billing card shows "Starter plan" + "Upgrade to Team".
2. Click "Upgrade to Team" → redirected to Lemon Squeezy's hosted checkout.
3. Complete checkout in test mode (no real charge) → redirected back to
   `/dashboard/settings?checkout=success`.
4. Within a few seconds (webhook delivery), refresh → Billing card now shows
   "Team plan" + "Manage subscription", confirm via
   `npx supabase db query "select * from billing_subscriptions where user_id = '<your user id>'"`
   that `status = 'active'`.
5. Click "Manage subscription" → opens Lemon Squeezy's customer portal in a new tab.
6. In the customer portal, cancel the subscription → back in the app, refresh
   Settings → Billing card still shows "Team plan" with an "Ends {date}" badge
   (mid-period access retained), confirm `status = 'cancelled'` and `ends_at`
   is set via the same `db query` command.
7. Clean up: cancel/delete the test subscription in the Lemon Squeezy test-mode
   dashboard if it leaves any lingering state you don't want.

- [x] **Step 5: Write `docs/billing-lemonsqueezy.md`**

Record: the problem (no way to collect payment despite a pricing page),
the Merchant-of-Record choice and why, the `billing_subscriptions` data model,
the webhook's upsert-everything-from-current-state approach and why it doesn't
branch per event, the explicit "no feature gating in this pass" scope decision
and what was descoped from the landing page copy as a result, and a pointer to
the design spec. Follow the structure of `docs/vendor-stats-scalability.md`.

- [x] **Step 6: Final commit**

```bash
git add docs/third-party-services.md docs/billing-lemonsqueezy.md
git commit -m "docs: record Lemon Squeezy billing integration"
```

---

## File Structure Summary

**Created:**
- `supabase/migrations/20260725150000_billing_subscriptions.sql`
- `src/lib/billing.ts` / `src/lib/billing.test.ts`
- `src/lib/lemonsqueezy-webhook.ts` / `src/lib/lemonsqueezy-webhook.test.ts`
- `src/lib/lemonsqueezy.ts`
- `src/app/api/webhooks/lemonsqueezy/route.ts`
- `src/app/dashboard/settings/billing-card.tsx`
- `docs/billing-lemonsqueezy.md`

**Modified:**
- `.env.local.example`
- `src/app/dashboard/actions.ts`
- `src/app/dashboard/settings/page.tsx`
- `src/lib/landing/dictionary.ts`
- `docs/third-party-services.md`
