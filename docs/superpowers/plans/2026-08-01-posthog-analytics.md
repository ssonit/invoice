# PostHog Analytics — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add client-only PostHog product analytics with autocapture + 5 custom business events, silently no-opping when the env key is unset.

**Architecture:** `posthog-js` SDK initialized once in a client `PostHogProvider` wrapping the root layout. A `PostHogPageView` component captures SPA route changes. Five custom `posthog.capture()` calls at key user actions. No server SDK, no middleware, no new API routes.

**Tech Stack:** Next.js 16, React 19, TypeScript, `posthog-js` (no `posthog-node`)

## Global Constraints

- Follow `.claude/rules/` conventions (code-style, naming, components, testing)
- `NEXT_PUBLIC_*` prefix for browser-exposed env vars
- Optional env var pattern: unset → silent no-op (same as Upstash Redis)
- Client components must have `"use client"` directive
- Provider pattern: `src/components/<name>-provider.tsx`, thin wrapper around SDK provider
- Unit test all pure `src/lib/` logic; thin SDK wrappers are deliberately not unit-tested
- Run quality gate before final commit: `npm run test && npm run lint && npx tsc --noEmit`

---

### Task 1: Install posthog-js

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the dependency**

```bash
npm install posthog-js
```

- [ ] **Step 2: Verify installation**

```bash
npx tsc --noEmit
```

Expected: No type errors from the new package.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add posthog-js dependency

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Create PostHogProvider component

**Files:**
- Create: `src/components/posthog-provider.tsx`

**Interfaces:**
- Produces: `PostHogProvider({ children }: { children: React.ReactNode })` — root-level client component wrapping `<PHProvider client={posthog}>`

- [ ] **Step 1: Create the provider file**

```tsx
"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect } from "react";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com";

export function PostHogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (POSTHOG_KEY) {
      posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        capture_pageview: false, // handled by PostHogPageView
        autocapture: true, // clicks, inputs, etc.
      });
    }
  }, []);

  if (!POSTHOG_KEY) return children; // silent no-op when key is unset

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
```

- [ ] **Step 2: Check type safety**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/posthog-provider.tsx
git commit -m "feat: add PostHogProvider client component

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Create PostHogPageView component

**Files:**
- Create: `src/components/posthog-pageview.tsx`

**Interfaces:**
- Produces: `PostHogPageView()` — renders `null`, captures `$pageview` event on every route change via `usePostHog()` hook + `usePathname()`/`useSearchParams()`

- [ ] **Step 1: Create the page view tracking component**

```tsx
"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { useEffect } from "react";

export function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthog = usePostHog();

  useEffect(() => {
    if (pathname && posthog) {
      const url = searchParams.size
        ? `${pathname}?${searchParams}`
        : pathname;
      posthog.capture("$pageview", { $current_url: url });
    }
  }, [pathname, searchParams, posthog]);

  return null;
}
```

- [ ] **Step 2: Check type safety**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/posthog-pageview.tsx
git commit -m "feat: add PostHogPageView for SPA page view tracking

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Wire PostHogProvider + PostHogPageView into root layout

**Files:**
- Modify: `src/app/layout.tsx` (lines 3-4, 30-41)

**Interfaces:**
- Consumes: `PostHogProvider` from `@/components/posthog-provider`
- Consumes: `PostHogPageView` from `@/components/posthog-pageview`

- [ ] **Step 1: Add imports at the top of `src/app/layout.tsx`**

Import after the existing imports (after the `JetBrains_Mono` font declaration, before `metadata`):

```tsx
import { PostHogProvider } from "@/components/posthog-provider";
import { PostHogPageView } from "@/components/posthog-pageview";
```

- [ ] **Step 2: Wrap children with PostHogProvider and add PostHogPageView**

In the return statement, change this:

```tsx
<body className="min-h-full flex flex-col bg-background text-foreground">
  {children}
  <Toaster />
</body>
```

To this:

```tsx
<body className="min-h-full flex flex-col bg-background text-foreground">
  <PostHogProvider>
    <PostHogPageView />
    {children}
  </PostHogProvider>
  <Toaster />
</body>
```

- [ ] **Step 3: Verify the build compiles**

```bash
npx tsc --noEmit
```

Expected: No type errors. The provider and page-view are both `"use client"` components imported into a server component — this is valid in Next.js App Router.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: wire PostHogProvider and PostHogPageView into root layout

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: Document environment variables

**Files:**
- Modify: `.env.local.example`

- [ ] **Step 1: Add PostHog section to `.env.local.example`**

Append after the `STARTER_MONTHLY_INVOICE_LIMIT` line:

```sh
# PostHog — product analytics (client-side only)
# Get the key from https://app.posthog.com → Project settings (starts with phc_).
# Optional: if unset, analytics silently no-ops (no tracking).
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com  # default; EU: https://eu.posthog.com
```

- [ ] **Step 2: Commit**

```bash
git add .env.local.example
git commit -m "docs: document PostHog env vars in .env.local.example

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: Add custom events to key user actions

**Files:**
- Modify: Wherever each action completes successfully (see per-event steps below)

- [ ] **Step 1: `user_signed_up` — in signup callback route**

Find the signup callback route (likely at `src/app/auth/callback/route.ts` or similar). After successful signup, add:

```tsx
// At the top of the file (if it's a client component):
import posthog from "posthog-js";

// After successful signup:
posthog.capture("user_signed_up", { provider }); // provider from the auth provider
```

> **Note:** Signup callback may be a server route. If so, skip this event — the `$pageview` on first dashboard load already captures the activation signal.

- [ ] **Step 2: `invoice_uploaded` — in invoice upload component**

Find the upload success handler. After successful upload:

```tsx
import { usePostHog } from "posthog-js/react";

// Inside the component:
const posthog = usePostHog();

// In the upload success handler:
posthog?.capture("invoice_uploaded", {
  file_type: fileName?.endsWith(".pdf") ? "pdf" : "image",
  extraction_provider: process.env.NEXT_PUBLIC_EXTRACTION_PROVIDER,
});
```

- [ ] **Step 3: `invoice_extracted` — in invoice detail/list after extraction**

After extraction completes and data is available:

```tsx
import { usePostHog } from "posthog-js/react";

const posthog = usePostHog();

posthog?.capture("invoice_extracted", {
  vendor_name: invoice.vendorName,
  currency: invoice.currency,
  total_amount: invoice.totalAmount,
});
```

- [ ] **Step 4: `invoice_forwarded` — in inbox or forward-form component**

After successful forward:

```tsx
import { usePostHog } from "posthog-js/react";

const posthog = usePostHog();

posthog?.capture("invoice_forwarded");
```

- [ ] **Step 5: `subscription_upgraded` — in billing/settings component**

After successful checkout/upgrade:

```tsx
import { usePostHog } from "posthog-js/react";

const posthog = usePostHog();

posthog?.capture("subscription_upgraded", {
  plan: "team",
  previous_plan: "starter",
});
```

- [ ] **Step 6: Check type safety for all modified files**

```bash
npx tsc --noEmit
npx lint
```

Expected: No errors.

- [ ] **Step 7: Commit each file individually (or as a single feat commit)**

```bash
git add <modified-files>
git commit -m "feat: add PostHog custom events for key user actions

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: Quality gate + final verification

**Files:**
- Verify: all modified files

- [ ] **Step 1: Run full quality gate**

```bash
npm run test && npm run lint && npx tsc --noEmit
```

Expected: All pass. Tests, lint, and type-check are clean.

- [ ] **Step 2: Run production build**

```bash
npm run build
```

Expected: Build succeeds without PostHog key set (verifies the silent-no-op path works).

- [ ] **Step 3: Manual smoke test (with key set)**

```bash
# Temporary: set a PostHog key for local testing
echo 'NEXT_PUBLIC_POSTHOG_KEY=phc_testkey' >> .env.local

npm run dev
```

1. Open http://localhost:3000
2. Navigate between pages → check PostHog dashboard → Live Events for `$pageview`
3. Upload an invoice → check for `invoice_uploaded` + `invoice_extracted`
4. Remove the test key from `.env.local`

- [ ] **Step 4: Final commit (if any cleanup)**

```bash
git add -A
git commit -m "chore: quality gate pass for PostHog integration

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 8: Update third-party-services.md

**Files:**
- Modify: `docs/third-party-services.md`

- [ ] **Step 1: Add PostHog section to docs**

Append to `docs/third-party-services.md`:

```markdown
## PostHog (product analytics)

- Free plan: $0/month, 1M events/month, unlimited seats, 1-year data retention.
  No credit card required.
- Client-side only via `posthog-js` SDK — no server SDK needed for basic analytics.
- Set `NEXT_PUBLIC_POSTHOG_KEY` in `.env.local` to enable. Unset → no-op.
- EU users: set `NEXT_PUBLIC_POSTHOG_HOST=https://eu.posthog.com`.
- Dashboard: https://app.posthog.com (or https://eu.posthog.com for EU region).
```

- [ ] **Step 2: Commit**

```bash
git add docs/third-party-services.md
git commit -m "docs: add PostHog to third-party services

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Post-Plan: Deploy Checklist

After merging, for the Vercel Production deployment:

- [ ] Add `NEXT_PUBLIC_POSTHOG_KEY` to Vercel environment variables (Production)
- [ ] Add `NEXT_PUBLIC_POSTHOG_HOST` if using EU region
- [ ] Deploy → verify events appear in PostHog Live Events
- [ ] Check no console errors in browser DevTools
