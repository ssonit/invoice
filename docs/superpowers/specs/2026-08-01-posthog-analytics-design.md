# PostHog Product Analytics — Design

**Status:** Draft
**Approach:** A — Client-only (`posthog-js`)

## Goal

Basic product analytics for the Invoice Reader app: DAU/WAU/MAU, page views, and
key business actions. Start simple, expand to feature flags / session replays later
if needed.

## Non-goals

- Server-side tracking (Trigger.dev tasks, API routes)
- Feature flags, A/B testing, session replays (can add later)
- Reverse proxy for ad-blocker bypass
- Cookie consent banner (PostHog Cloud EU doesn't require it for first-party analytics)

## Architecture

```
Browser load → PostHogProvider init posthog-js with NEXT_PUBLIC_POSTHOG_KEY
                    │
Route change → PostHogPageView calls posthog.capture('$pageview')
                    │
User action  → posthog.capture('invoice_uploaded', { ...props })
                    │
                    ▼
         https://app.posthog.com  (EU: https://eu.posthog.com)
```

SDK gửi event qua network request trực tiếp, không cần API route trung gian.

## Files

```
Thêm mới:
  src/components/posthog-provider.tsx      ← client component, init posthog-js
  src/components/posthog-pageview.tsx      ← theo dõi page view khi route thay đổi

Sửa:
  src/app/layout.tsx                       ← import PostHogProvider, bọc {children}
  .env.local.example                       ← thêm NEXT_PUBLIC_POSTHOG_KEY, NEXT_PUBLIC_POSTHOG_HOST

Dependency mới:
  posthog-js                               ← npm install posthog-js
```

## Provider Component

```tsx
// src/components/posthog-provider.tsx
'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useEffect } from 'react';

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (POSTHOG_KEY) {
      posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        capture_pageview: false, // handled by PostHogPageView
        autocapture: true,       // clicks, inputs, etc.
      });
    }
  }, []);

  if (!POSTHOG_KEY) return children; // silent no-op when key is unset

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
```

## Page View Tracking

```tsx
// src/components/posthog-pageview.tsx
'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { usePostHog } from 'posthog-js/react';
import { useEffect } from 'react';

export function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthog = usePostHog();

  useEffect(() => {
    if (pathname && posthog) {
      const url = searchParams.size
        ? `${pathname}?${searchParams}`
        : pathname;
      posthog.capture('$pageview', { $current_url: url });
    }
  }, [pathname, searchParams, posthog]);

  return null;
}
```

## Root Layout Integration

```tsx
// src/app/layout.tsx
import { PostHogProvider } from '@/components/posthog-provider';
import { PostHogPageView } from '@/components/posthog-pageview';

// Inside <body>:
<PostHogProvider>
  <PostHogPageView />
  {children}
</PostHogProvider>
```

## Environment Variables

```sh
# PostHog — product analytics (client-side only)
# Optional: if unset, analytics silently no-ops (no tracking).
# Get the key from https://app.posthog.com → Project settings.
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com   # default; EU users: https://eu.posthog.com
```

- `NEXT_PUBLIC_POSTHOG_KEY` — project API key (phc_... prefix = public, write-only)
- `NEXT_PUBLIC_POSTHOG_HOST` — optional, defaults to `https://app.posthog.com`
- Optional: không set → analytics no-op, app chạy bình thường (same pattern as Upstash)
- No changes to `src/lib/validation/env.ts` needed (optional var, same as Upstash)

## Custom Events

Autocapture đã bắt page views, clicks, inputs. Thêm custom events cho business actions:

| Event | When | Props |
|---|---|---|
| `invoice_uploaded` | Upload thành công | `file_type`, `extraction_provider` |
| `invoice_extracted` | Extraction hoàn tất | `vendor_name`, `currency`, `total_amount` |
| `invoice_forwarded` | Forward email đến inbox | — |
| `user_signed_up` | Tạo tài khoản mới | `provider` |
| `subscription_upgraded` | Upgrade lên Team | `plan`, `previous_plan` |

Gọi đơn giản, một dòng:

```tsx
const posthog = usePostHog();
posthog?.capture('invoice_uploaded', { file_type: 'pdf' });
```

### Data Privacy

- **No PII** — không gửi email, tên user, nội dung invoice, IP address
- PostHog Cloud EU option cho GDPR compliance
- `posthog-js` mặc định strip PII từ autocapture events

## Error Handling

Three layers of defense — PostHog failure never breaks the app:

| Layer | Mechanism | Result on failure |
|---|---|---|
| Provider | `if (!POSTHOG_KEY) return children` | App renders normally, no provider |
| Hook | `usePostHog()` returns `undefined` when not initialized | `posthog?.capture()` = no-op |
| Network | SDK retries 3×, then drops event | No UI blocking, no infinite retry |

No `try/catch` needed around `capture()` calls — SDK handles errors internally.

## Testing

- **No unit tests** for PostHog provider/pageview components (thin SDK wrappers — same
  convention as extraction SDK wrappers)
- `npm run build` must pass (verifies SSR compatibility, no client-only imports in server
  components)
- **Manual smoke test**: set `NEXT_PUBLIC_POSTHOG_KEY`, open browser, verify events appear
  in PostHog dashboard → Live Events
- Quick smoke: navigate between pages → `$pageview` events. Upload an invoice →
  `invoice_uploaded` + `invoice_extracted` events.

## Related

- [`docs/third-party-services.md`](../../third-party-services.md) — add PostHog entry
- [`.env.local.example`](../../.env.local.example)
- PostHog free tier: 1M events/month, no credit card required
