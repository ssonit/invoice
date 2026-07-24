# System Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close four scoped gaps: self-service password recovery, content-hash dedup for manual uploads, server-side pagination + filtering for the Invoices page, and an account-settings page (change password / delete account).

**Architecture:** Each of the four areas gets its own small group of tasks — pure-logic pieces (validation schemas, hashing, pagination math) are unit-tested first, then wired into pages/Server Actions/routes which are verified manually (matching the project's established split).

**Tech Stack:** Next.js 16 App Router, `@supabase/ssr`, Supabase Auth (`resetPasswordForEmail`, `updateUser`), Node `crypto`, `@tanstack/react-table` (manual pagination/filtering mode), Vitest.

**Design spec:** `docs/superpowers/specs/2026-07-23-system-hardening-design.md`

---

## Task 1: Password-recovery validation schemas

**Files:**
- Modify: `src/lib/validation/auth.ts`
- Modify: `src/lib/validation/auth.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/validation/auth.test.ts`:
```ts
import { parseForgotPasswordForm, parseResetPasswordForm } from "./auth";

describe("parseForgotPasswordForm", () => {
  it("accepts a valid email", () => {
    const result = parseForgotPasswordForm(formData({ email: "a@example.com" }));
    expect(result).toEqual({ success: true, data: { email: "a@example.com" } });
  });

  it("trims the email", () => {
    const result = parseForgotPasswordForm(formData({ email: "  a@example.com  " }));
    expect(result).toEqual({ success: true, data: { email: "a@example.com" } });
  });

  it("rejects an invalid email", () => {
    expect(parseForgotPasswordForm(formData({ email: "not-an-email" })).success).toBe(
      false,
    );
  });

  it("rejects a missing email", () => {
    expect(parseForgotPasswordForm(formData({})).success).toBe(false);
  });
});

describe("parseResetPasswordForm", () => {
  it("accepts a password of 6+ characters", () => {
    const result = parseResetPasswordForm(formData({ password: "abcdef" }));
    expect(result).toEqual({ success: true, data: { password: "abcdef" } });
  });

  it("rejects a password shorter than 6 characters", () => {
    expect(parseResetPasswordForm(formData({ password: "abcde" })).success).toBe(false);
  });

  it("rejects a missing password", () => {
    expect(parseResetPasswordForm(formData({})).success).toBe(false);
  });
});
```

(`formData` is the helper already defined at the top of this test file for the existing
`parseLoginForm`/`parseSignupForm` tests — reuse it, don't redefine it.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/validation/auth.test.ts`
Expected: FAIL — `parseForgotPasswordForm`/`parseResetPasswordForm` not exported yet.

- [ ] **Step 3: Add the schemas to `src/lib/validation/auth.ts`**

Append (after the existing `parseSignupForm`):
```ts
export const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export function parseForgotPasswordForm(
  formData: FormData,
): FormValidationResult<ForgotPasswordInput> {
  const result = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!result.success) {
    return { success: false, error: firstIssueMessage(result.error) };
  }
  return { success: true, data: result.data };
}

// Also reused by the account-settings "change password" form (Task 8) — same
// shape, no reason to duplicate it.
export const resetPasswordSchema = z.object({
  password: z.string().min(6, "Use at least 6 characters"),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export function parseResetPasswordForm(
  formData: FormData,
): FormValidationResult<ResetPasswordInput> {
  const result = resetPasswordSchema.safeParse({ password: formData.get("password") });
  if (!result.success) {
    return { success: false, error: firstIssueMessage(result.error) };
  }
  return { success: true, data: result.data };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/validation/auth.test.ts`
Expected: PASS (all tests, existing + new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/validation/auth.ts src/lib/validation/auth.test.ts
git commit -m "feat: add forgot/reset password validation schemas"
```

---

## Task 2: Password-recovery pages, callback route, and route allowlist

Orchestration (Server Actions, Route Handler, pages) — not unit-tested; verified manually
in Task 10 via the local Supabase Inbucket mail UI (`npx supabase status` prints its URL).

**Files:**
- Modify: `src/lib/supabase/update-session.ts`
- Modify: `src/app/login/page.tsx`
- Create: `src/app/forgot-password/page.tsx`
- Create: `src/app/forgot-password/actions.ts`
- Create: `src/app/auth/callback/route.ts`
- Create: `src/app/reset-password/page.tsx`
- Create: `src/app/reset-password/actions.ts`

- [ ] **Step 1: Allowlist the new routes in the session middleware**

In `src/lib/supabase/update-session.ts`, change:
```ts
  const isAuthRoute =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/signup");
```
to:
```ts
  const isAuthRoute =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/signup") ||
    request.nextUrl.pathname.startsWith("/forgot-password") ||
    request.nextUrl.pathname.startsWith("/reset-password") ||
    request.nextUrl.pathname.startsWith("/auth/callback");
```

- [ ] **Step 2: `/forgot-password` Server Action**

`src/app/forgot-password/actions.ts`:
```ts
"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { parseForgotPasswordForm } from "@/lib/validation/auth";

export async function requestPasswordReset(formData: FormData) {
  const parsed = parseForgotPasswordForm(formData);
  if (!parsed.success) {
    redirect(`/forgot-password?error=${encodeURIComponent(parsed.error)}`);
  }

  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  // Always show the same success state, whether or not the email is
  // registered — don't let this endpoint reveal which emails have accounts.
  redirect("/forgot-password?sent=1");
}
```

- [ ] **Step 3: `/forgot-password` page**

`src/app/forgot-password/page.tsx`:
```tsx
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { requestPasswordReset } from "./actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  return (
    <AuthShell>
      <div className="mb-7">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Reset password
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-outfit)] text-2xl font-semibold tracking-tight">
          Forgot your password?
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Enter your email and we'll send you a reset link.
        </p>
      </div>

      {sent ? (
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
          If an account exists for that email, a reset link is on its way. Check your
          inbox.
        </div>
      ) : (
        <form action={requestPasswordReset}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@company.com"
                className="h-10"
              />
            </Field>
            {error ? (
              <div
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </div>
            ) : null}
            <Button
              type="submit"
              size="lg"
              className="mt-1 h-11 w-full rounded-full bg-[#E8FF47] text-[#0a0a0a] hover:bg-[#E8FF47]/90"
            >
              Send reset link
            </Button>
          </FieldGroup>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
```

- [ ] **Step 4: `/auth/callback` Route Handler**

`src/app/auth/callback/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("That link is invalid or has expired.")}`,
  );
}
```

- [ ] **Step 5: `/reset-password` Server Action**

`src/app/reset-password/actions.ts`:
```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseResetPasswordForm } from "@/lib/validation/auth";

export async function updatePassword(formData: FormData) {
  const parsed = parseResetPasswordForm(formData);
  if (!parsed.success) {
    redirect(`/reset-password?error=${encodeURIComponent(parsed.error)}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard");
}
```

- [ ] **Step 6: `/reset-password` page**

`src/app/reset-password/page.tsx`:
```tsx
import { AuthShell } from "@/components/auth/auth-shell";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updatePassword } from "./actions";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <AuthShell>
      <div className="mb-7">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Reset password
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-outfit)] text-2xl font-semibold tracking-tight">
          Choose a new password
        </h1>
      </div>

      <form action={updatePassword}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="password">New password</FieldLabel>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              placeholder="••••••••"
              className="h-10"
            />
          </Field>
          {error ? (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </div>
          ) : null}
          <Button
            type="submit"
            size="lg"
            className="mt-1 h-11 w-full rounded-full bg-[#E8FF47] text-[#0a0a0a] hover:bg-[#E8FF47]/90"
          >
            Update password
          </Button>
        </FieldGroup>
      </form>
    </AuthShell>
  );
}
```

- [ ] **Step 7: Add the "Forgot password?" link to `/login`**

In `src/app/login/page.tsx`, change:
```tsx
          <Field>
            <div className="flex items-center justify-between gap-2">
              <FieldLabel htmlFor="password">Password</FieldLabel>
            </div>
```
to:
```tsx
          <Field>
            <div className="flex items-center justify-between gap-2">
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Link
                href="/forgot-password"
                className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Forgot password?
              </Link>
            </div>
```
(`Link` from `next/link` is already imported at the top of this file.)

- [ ] **Step 8: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/lib/supabase/update-session.ts src/app/login/page.tsx src/app/forgot-password src/app/auth/callback src/app/reset-password
git commit -m "feat: add password recovery flow (forgot/reset password, auth callback)"
```

---

## Task 3: `src/lib/file-hash.ts`

**Files:**
- Create: `src/lib/file-hash.ts`
- Test: `src/lib/file-hash.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/lib/file-hash.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { sha256Hex } from "./file-hash";

describe("sha256Hex", () => {
  it("returns a 64-character lowercase hex string", () => {
    expect(sha256Hex(Buffer.from("hello"))).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for identical input", () => {
    expect(sha256Hex(Buffer.from("hello"))).toBe(sha256Hex(Buffer.from("hello")));
  });

  it("differs for different input", () => {
    expect(sha256Hex(Buffer.from("hello"))).not.toBe(sha256Hex(Buffer.from("world")));
  });

  it("handles an empty buffer", () => {
    expect(sha256Hex(Buffer.alloc(0))).toMatch(/^[0-9a-f]{64}$/);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/file-hash.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/lib/file-hash.ts`:
```ts
import { createHash } from "node:crypto";

/** Hex-encoded SHA-256 of a buffer — used to detect exact-duplicate file uploads. */
export function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/file-hash.test.ts`
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add src/lib/file-hash.ts src/lib/file-hash.test.ts
git commit -m "feat: add sha256Hex helper for upload dedup"
```

---

## Task 4: Upload dedup (migration + route)

**Files:**
- Create: `supabase/migrations/20260723120000_invoices_content_hash.sql`
- Modify: `src/app/api/invoices/upload/route.ts`

- [ ] **Step 1: Write the migration**

`supabase/migrations/20260723120000_invoices_content_hash.sql`:
```sql
-- Content-hash dedup for manually uploaded invoices (email invoices already
-- dedupe via source_ref/source_message_id). NULLs are distinct in a unique
-- constraint, so email-sourced rows (content_hash always null) never collide.
alter table public.invoices add column content_hash text;

alter table public.invoices
  add constraint invoices_user_content_hash_key
  unique (user_id, content_hash);
```

- [ ] **Step 2: Apply and verify**

Prerequisite: Docker Desktop running.

Run:
```bash
npx supabase db reset
```
Expected: reset completes, all migrations apply cleanly.

Run:
```bash
npx supabase db query "select column_name from information_schema.columns where table_name='invoices' and column_name='content_hash'; select conname from pg_constraint where conname='invoices_user_content_hash_key'"
```
Expected: both rows present.

- [ ] **Step 3: Wire the hash check into the upload route**

Replace `src/app/api/invoices/upload/route.ts` in full:
```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { extractInvoice } from "@/lib/extraction";
import { validateUploadFile } from "@/lib/validation/upload";
import { sha256Hex } from "@/lib/file-hash";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing file" }, { status: 400 });
  }

  const mimeType = file.type || "application/octet-stream";
  const validated = validateUploadFile({ type: mimeType, size: file.size });
  if (!validated.success) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const contentHash = sha256Hex(buffer);

  const service = createServiceClient();

  // Exact re-upload of a file already processed for this user — return the
  // existing invoice without spending an LLM call.
  const { data: existing } = await service
    .from("invoices")
    .select()
    .eq("user_id", user.id)
    .eq("content_hash", contentHash)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ invoice: existing, duplicate: true });
  }

  const input =
    mimeType === "application/pdf"
      ? ({ type: "pdf", data: buffer } as const)
      : ({ type: "image", data: buffer, mimeType } as const);

  const extracted = await extractInvoice(input);
  if (!extracted.is_invoice) {
    return NextResponse.json(
      { error: "this file does not look like an invoice" },
      { status: 422 },
    );
  }

  const path = `${user.id}/upload-${Date.now()}-${file.name}`;
  const { data: uploaded } = await service.storage
    .from("invoice-files")
    .upload(path, buffer, { upsert: true, contentType: mimeType });

  const { data: invoice, error } = await service
    .from("invoices")
    .upsert(
      {
        user_id: user.id,
        source: "upload",
        vendor: extracted.vendor,
        invoice_number: extracted.invoice_number,
        amount: extracted.amount,
        currency: extracted.currency,
        issue_date: extracted.issue_date,
        due_date: extracted.due_date,
        tax: extracted.tax,
        line_items: extracted.line_items,
        confidence_score: extracted.confidence_score,
        needs_review: extracted.confidence_score < 0.7,
        raw_extracted_json: extracted,
        file_url: uploaded?.path ?? null,
        content_hash: contentHash,
      },
      { onConflict: "user_id,content_hash" },
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ invoice });
}
```

Notes on the diff from the current version: (1) hash computed and checked before calling
`extractInvoice` — early-return on a hit; (2) final write changed from `.insert()` to
`.upsert(..., { onConflict: "user_id,content_hash" })` as a defense against two concurrent
requests for the same file racing past the existence check at the same time.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260723120000_invoices_content_hash.sql src/app/api/invoices/upload/route.ts
git commit -m "feat: dedupe manual uploads by file content hash"
```

---

## Task 5: `src/lib/pagination.ts`

**Files:**
- Create: `src/lib/pagination.ts`
- Test: `src/lib/pagination.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/lib/pagination.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { pageCount, paginationRange, parsePageParam } from "./pagination";

describe("parsePageParam", () => {
  it("defaults to 1 for undefined", () => {
    expect(parsePageParam(undefined)).toBe(1);
  });

  it("parses a valid positive integer string", () => {
    expect(parsePageParam("3")).toBe(3);
  });

  it("falls back to 1 for zero, negative, non-integer, or non-numeric values", () => {
    expect(parsePageParam("0")).toBe(1);
    expect(parsePageParam("-1")).toBe(1);
    expect(parsePageParam("2.5")).toBe(1);
    expect(parsePageParam("abc")).toBe(1);
  });
});

describe("paginationRange", () => {
  it("computes the 0-indexed range for page 1", () => {
    expect(paginationRange(1, 20)).toEqual({ from: 0, to: 19 });
  });

  it("computes the range for a later page", () => {
    expect(paginationRange(3, 20)).toEqual({ from: 40, to: 59 });
  });

  it("handles a page size of 1", () => {
    expect(paginationRange(5, 1)).toEqual({ from: 4, to: 4 });
  });
});

describe("pageCount", () => {
  it("returns 1 for zero total rows (never show 0 pages)", () => {
    expect(pageCount(0, 20)).toBe(1);
  });

  it("rounds up for a partial last page", () => {
    expect(pageCount(21, 20)).toBe(2);
  });

  it("returns an exact count when total is a multiple of pageSize", () => {
    expect(pageCount(40, 20)).toBe(2);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/pagination.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/lib/pagination.ts`:
```ts
/** Parses a `?page=` search param, defaulting to 1 for anything invalid. */
export function parsePageParam(value: string | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

/** 0-indexed [from, to] range for Supabase's `.range()`, from a 1-indexed page. */
export function paginationRange(page: number, pageSize: number): { from: number; to: number } {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

/** Total pages for a given row count, never less than 1. */
export function pageCount(totalCount: number, pageSize: number): number {
  return Math.max(1, Math.ceil(totalCount / pageSize));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/pagination.test.ts`
Expected: PASS (9/9).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pagination.ts src/lib/pagination.test.ts
git commit -m "feat: add pagination math helpers"
```

---

## Task 6: `src/lib/invoices/query.ts`

**Files:**
- Create: `src/lib/invoices/query.ts`
- Test: `src/lib/invoices/query.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/lib/invoices/query.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { isDefaultInvoiceListQuery, parseInvoiceListQuery } from "./query";

describe("parseInvoiceListQuery", () => {
  it("defaults page to 1, vendor to empty, status to 'all'", () => {
    expect(parseInvoiceListQuery({})).toEqual({ page: 1, vendor: "", status: "all" });
  });

  it("parses a valid page/vendor/status", () => {
    expect(parseInvoiceListQuery({ page: "2", vendor: "acme", status: "review" })).toEqual(
      { page: 2, vendor: "acme", status: "review" },
    );
  });

  it("trims and length-caps the vendor search", () => {
    expect(parseInvoiceListQuery({ vendor: "  acme  " }).vendor).toBe("acme");
    expect(parseInvoiceListQuery({ vendor: "a".repeat(500) }).vendor).toHaveLength(100);
  });

  it("falls back to 'all' for an unknown status value", () => {
    expect(parseInvoiceListQuery({ status: "bogus" }).status).toBe("all");
  });
});

describe("isDefaultInvoiceListQuery", () => {
  it("is true for the default shape", () => {
    expect(isDefaultInvoiceListQuery({ page: 1, vendor: "", status: "all" })).toBe(true);
  });

  it("is false when any field differs from the default", () => {
    expect(isDefaultInvoiceListQuery({ page: 2, vendor: "", status: "all" })).toBe(false);
    expect(isDefaultInvoiceListQuery({ page: 1, vendor: "acme", status: "all" })).toBe(
      false,
    );
    expect(isDefaultInvoiceListQuery({ page: 1, vendor: "", status: "review" })).toBe(
      false,
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/invoices/query.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/lib/invoices/query.ts`:
```ts
import { parsePageParam } from "@/lib/pagination";

export const INVOICE_LIST_PAGE_SIZE = 20;

export type InvoiceListStatus = "all" | "review" | "ok";

export type InvoiceListQuery = {
  page: number;
  vendor: string;
  status: InvoiceListStatus;
};

const VENDOR_SEARCH_MAX_LENGTH = 100;
const STATUS_VALUES = new Set<string>(["all", "review", "ok"]);

export function parseInvoiceListQuery(params: {
  page?: string;
  vendor?: string;
  status?: string;
}): InvoiceListQuery {
  return {
    page: parsePageParam(params.page),
    vendor: (params.vendor ?? "").trim().slice(0, VENDOR_SEARCH_MAX_LENGTH),
    status: STATUS_VALUES.has(params.status ?? "")
      ? (params.status as InvoiceListStatus)
      : "all",
  };
}

export function isDefaultInvoiceListQuery(query: InvoiceListQuery): boolean {
  return query.page === 1 && query.vendor.length === 0 && query.status === "all";
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/invoices/query.test.ts`
Expected: PASS (7/7).

- [ ] **Step 5: Commit**

```bash
git add src/lib/invoices/query.ts src/lib/invoices/query.test.ts
git commit -m "feat: add invoice list query parsing (page/vendor/status)"
```

---

## Task 7: Wire pagination + server-side filtering into the Invoices page

Orchestration — not unit-tested (the pure logic it depends on already is, in Tasks 5–6);
verified manually in Task 10.

**Files:**
- Modify: `src/app/dashboard/invoices/page.tsx`
- Modify: `src/components/dashboard/invoices-table.tsx`
- Create: `src/components/dashboard/invoices-toolbar.tsx`
- Modify: `src/components/dashboard/columns.tsx`

- [ ] **Step 1: Query with pagination + filters in the page**

Replace `src/app/dashboard/invoices/page.tsx` in full:
```tsx
import { createClient } from "@/lib/supabase/server"
import { ContentShell } from "@/components/dashboard/content-shell"
import { InvoicesTable } from "@/components/dashboard/invoices-table"
import { UploadInvoiceButton } from "../upload-invoice-button"
import { normalizeInvoice } from "@/lib/invoices"
import { escapeIlike } from "@/lib/vendors/query"
import {
  INVOICE_LIST_PAGE_SIZE,
  parseInvoiceListQuery,
} from "@/lib/invoices/query"
import { pageCount, paginationRange } from "@/lib/pagination"

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; vendor?: string; status?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const query = parseInvoiceListQuery(await searchParams)
  const { from, to } = paginationRange(query.page, INVOICE_LIST_PAGE_SIZE)

  let dbQuery = supabase
    .from("invoices")
    .select("*", { count: "exact" })
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })

  if (query.vendor) {
    dbQuery = dbQuery.ilike("vendor", `%${escapeIlike(query.vendor)}%`)
  }
  if (query.status === "review") dbQuery = dbQuery.eq("needs_review", true)
  if (query.status === "ok") dbQuery = dbQuery.eq("needs_review", false)

  const { data, count } = await dbQuery.range(from, to)

  const invoices = (data ?? []).map(normalizeInvoice)
  const totalPages = pageCount(count ?? 0, INVOICE_LIST_PAGE_SIZE)

  return (
    <ContentShell
      title="Invoices"
      description="Every invoice extracted from your forwarded email and manual uploads."
      actions={<UploadInvoiceButton />}
    >
      <InvoicesTable
        data={invoices}
        query={query}
        totalCount={count ?? 0}
        pageCount={totalPages}
      />
    </ContentShell>
  )
}
```

- [ ] **Step 2: Status filter must be exhaustive over the column's derived values**

`src/components/dashboard/columns.tsx` currently derives `status` client-side as
`row.needs_review ? "review" : "ok"` and had a `filterFn: "equalsString"` for client-side
filtering. Since filtering moves server-side, that `filterFn` is no longer used for
filtering (server already returns only matching rows) — remove it to avoid confusion, but
keep `accessorFn`/`cell` unchanged (still used for display + column sort):

Change:
```ts
  {
    id: "status",
    accessorFn: (row) => (row.needs_review ? "review" : "ok"),
    header: "Status",
    cell: ({ row }) =>
      row.original.needs_review ? (
        <Badge variant="secondary">Needs review</Badge>
      ) : (
        <Badge variant="outline">OK</Badge>
      ),
    enableSorting: false,
    filterFn: "equalsString",
  },
```
to:
```ts
  {
    id: "status",
    accessorFn: (row) => (row.needs_review ? "review" : "ok"),
    header: "Status",
    cell: ({ row }) =>
      row.original.needs_review ? (
        <Badge variant="secondary">Needs review</Badge>
      ) : (
        <Badge variant="outline">OK</Badge>
      ),
    enableSorting: false,
  },
```
Also remove the now-unused `filterFn: "includesString"` on the `vendor` column, same
reason. Change:
```ts
  {
    accessorKey: "vendor",
    header: ({ column }) => <SortHeader label="Vendor" column={column} />,
    cell: ({ row }) => (
      <span className="font-medium">{row.original.vendor ?? "-"}</span>
    ),
    filterFn: "includesString",
  },
```
to:
```ts
  {
    accessorKey: "vendor",
    header: ({ column }) => <SortHeader label="Vendor" column={column} />,
    cell: ({ row }) => (
      <span className="font-medium">{row.original.vendor ?? "-"}</span>
    ),
  },
```

- [ ] **Step 3: New toolbar component (URL-param driven, mirrors `vendors-toolbar.tsx`)**

`src/components/dashboard/invoices-toolbar.tsx`:
```tsx
"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  isDefaultInvoiceListQuery,
  type InvoiceListQuery,
  type InvoiceListStatus,
} from "@/lib/invoices/query"
import { cn } from "@/lib/utils"

const STATUS_OPTIONS: { label: string; value: InvoiceListStatus }[] = [
  { label: "All", value: "all" },
  { label: "Needs review", value: "review" },
  { label: "OK", value: "ok" },
]

const SEARCH_DEBOUNCE_MS = 300

function buildHref(pathname: string, next: InvoiceListQuery): string {
  const params = new URLSearchParams()
  if (next.vendor) params.set("vendor", next.vendor)
  if (next.status !== "all") params.set("status", next.status)
  if (next.page !== 1) params.set("page", String(next.page))
  const qs = params.toString()
  return qs ? `${pathname}?${qs}` : pathname
}

export function InvoicesToolbar({
  query,
  resultCount,
}: {
  query: InvoiceListQuery
  resultCount: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [vendor, setVendor] = useState(query.vendor)
  const queryRef = useRef(query)
  queryRef.current = query

  useEffect(() => {
    setVendor(query.vendor)
  }, [query.vendor])

  function navigate(patch: Partial<InvoiceListQuery>) {
    const current = queryRef.current
    const next: InvoiceListQuery = {
      vendor: patch.vendor !== undefined ? patch.vendor.trim() : current.vendor,
      status: patch.status ?? current.status,
      // Any filter change resets to page 1; explicit page changes pass page directly.
      page: patch.page ?? 1,
    }
    startTransition(() => {
      router.push(buildHref(pathname, next))
    })
  }

  useEffect(() => {
    if (vendor === query.vendor) return
    const handle = window.setTimeout(() => navigate({ vendor }), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce search
  }, [vendor, query.vendor, pathname])

  const hasActive = !isDefaultInvoiceListQuery(query)

  return (
    <div className={cn("flex flex-col gap-3", isPending && "opacity-70")}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 max-w-xs flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            placeholder="Filter by vendor..."
            className="h-8 ps-8"
            aria-label="Filter by vendor"
          />
        </div>
        <div className="flex items-center gap-1">
          {STATUS_OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant={query.status === option.value ? "secondary" : "ghost"}
              size="sm"
              onClick={() => navigate({ status: option.value })}
            >
              {option.label}
            </Button>
          ))}
        </div>
        {hasActive ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setVendor("")
              startTransition(() => router.push(pathname))
            }}
          >
            <X data-icon="inline-start" />
            Clear
          </Button>
        ) : null}
      </div>
      <p className="text-[12px] text-muted-foreground">{resultCount} invoice(s)</p>
    </div>
  )
}
```

- [ ] **Step 4: Update `InvoicesTable` to manual pagination + accept the toolbar**

Replace `src/components/dashboard/invoices-table.tsx` in full:
```tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Inbox } from "lucide-react";
import { columns } from "./columns";
import { InvoicesToolbar } from "./invoices-toolbar";
import type { InvoiceRow } from "@/lib/invoices";
import type { InvoiceListQuery } from "@/lib/invoices/query";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export function InvoicesTable({
  data,
  query,
  totalCount,
  pageCount,
}: {
  data: InvoiceRow[];
  query: InvoiceListQuery;
  totalCount: number;
  pageCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [sorting, setSorting] = useState<SortingState>([]);

  // TanStack Table returns non-memoizable functions; React Compiler skips it.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  function goToPage(page: number) {
    const params = new URLSearchParams();
    if (query.vendor) params.set("vendor", query.vendor);
    if (query.status !== "all") params.set("status", query.status);
    if (page !== 1) params.set("page", String(page));
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  const isEmpty = data.length === 0 && totalCount === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-col gap-3">
        <InvoicesToolbar query={query} resultCount={totalCount} />
        <Empty className="rounded-[14px] border border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Inbox />
            </EmptyMedia>
            <EmptyTitle>No invoices yet</EmptyTitle>
            <EmptyDescription>
              Forward an invoice to your address in Settings, or upload one directly.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <InvoicesToolbar query={query} resultCount={totalCount} />

      <div className={isPending ? "opacity-70" : undefined}>
        <div className="overflow-x-auto rounded-[14px] border border-border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className="bg-muted/40 hover:bg-muted/40">
                  {hg.headers.map((header) => (
                    <TableHead key={header.id} className="text-[12px]">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} className="text-[13px]">
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-20 text-center text-[13px] text-muted-foreground"
                  >
                    No invoices match your filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <p className="text-[12px] text-muted-foreground">{totalCount} invoice(s) total</p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(query.page - 1)}
              disabled={query.page <= 1}
            >
              Previous
            </Button>
            <span className="text-[12px] text-muted-foreground">
              Page {query.page} of {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(query.page + 1)}
              disabled={query.page >= pageCount}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

Note: `getPaginationRowModel`/`getFilteredRowModel` imports are dropped entirely (no
longer used) — sorting (`getSortedRowModel`) is the only client-side row model left,
scoped to the current page's rows as decided in the design spec.

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint src/components/dashboard/invoices-table.tsx src/components/dashboard/invoices-toolbar.tsx src/components/dashboard/columns.tsx src/app/dashboard/invoices/page.tsx`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/invoices/page.tsx src/components/dashboard/invoices-table.tsx src/components/dashboard/invoices-toolbar.tsx src/components/dashboard/columns.tsx
git commit -m "feat: server-side pagination and filtering for the Invoices page"
```

---

## Task 8: Account settings — change password

**Files:**
- Modify: `src/app/dashboard/actions.ts`
- Create: `src/app/dashboard/settings/change-password-form.tsx`
- Modify: `src/app/dashboard/settings/page.tsx`

- [ ] **Step 1: Server Action**

Append to `src/app/dashboard/actions.ts`:
```ts
import { parseResetPasswordForm } from "@/lib/validation/auth";

export type ChangePasswordResult = { ok: true } | { ok: false; error: string };

export async function changePassword(formData: FormData): Promise<ChangePasswordResult> {
  const parsed = parseResetPasswordForm(formData);
  if (!parsed.success) return { ok: false, error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}
```
(Add the `parseResetPasswordForm` import alongside the existing imports at the top of the
file — don't duplicate the `createClient`/`createServiceClient`/`createUserInbox` imports
already there.)

- [ ] **Step 2: Client form component**

`src/app/dashboard/settings/change-password-form.tsx`:
```tsx
"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { changePassword } from "../actions";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function ChangePasswordForm() {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await changePassword(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Password updated.");
      formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} action={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="password">New password</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            className="h-9"
          />
        </Field>
        {error ? (
          <p role="alert" className="text-[12px] text-destructive">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="sm" disabled={isPending} className="w-fit">
          {isPending ? <Spinner data-icon="inline-start" /> : null}
          {isPending ? "Updating..." : "Update password"}
        </Button>
      </FieldGroup>
    </form>
  );
}
```

- [ ] **Step 3: Add the card to the settings page**

`ContentShell` (`src/components/dashboard/content-shell.tsx`) renders `{children}` inside
a plain `<div className="mt-5">` with no `gap` — multiple `<Card>` siblings would sit flush
against each other with no spacing, so wrap them in a `flex flex-col gap-4`. Replace
`src/app/dashboard/settings/page.tsx` in full:

```tsx
import { createClient } from "@/lib/supabase/server";
import { ContentShell } from "@/components/dashboard/content-shell";
import { CopyEmailButton } from "../copy-email-button";
import { CreateInboxButton } from "./create-inbox-button";
import { ChangePasswordForm } from "./change-password-form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: inbox } = await supabase
    .from("inboxes")
    .select("email_address")
    .eq("user_id", user!.id)
    .maybeSingle();

  return (
    <ContentShell
      title="Settings"
      description="Set up email forwarding so invoices land in your dashboard automatically."
    >
      <div className="flex flex-col gap-4">
        <Card className="rounded-[14px] shadow-none">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="text-[13px] font-semibold">Forwarding address</CardTitle>
              {inbox ? (
                <Badge
                  variant="outline"
                  className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                >
                  <CheckCircle2 className="size-3" />
                  Active
                </Badge>
              ) : null}
            </div>
            <CardDescription className="text-[13px]">
              Forward invoice emails to this address, or set up an auto-forward rule in
              Gmail/Outlook. Anything that arrives is parsed and added to your invoices.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {inbox ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <code className="rounded-[8px] bg-muted px-3 py-1.5 font-mono text-[13px]">
                    {inbox.email_address}
                  </code>
                  <CopyEmailButton email={inbox.email_address} />
                </div>
                <p className="text-[12px] text-muted-foreground">
                  This is your permanent forwarding address — you only get one per account.
                </p>
              </div>
            ) : (
              <CreateInboxButton />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[14px] shadow-none">
          <CardHeader>
            <CardTitle className="text-[13px] font-semibold">Password</CardTitle>
            <CardDescription className="text-[13px]">
              Update the password you use to sign in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </div>
    </ContentShell>
  );
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/actions.ts src/app/dashboard/settings/change-password-form.tsx src/app/dashboard/settings/page.tsx
git commit -m "feat: add change-password to account settings"
```

---

## Task 9: Account settings — delete account (soft delete, no data removed)

**No data is physically deleted anywhere in this task.** "Delete account" sets a
`deleted_at` flag on the user's `profiles` row and blocks future login — `invoices`,
`vendors`, `inboxes`, and the `auth.users` row itself are all left exactly as they were.

**Files:**
- Create: `supabase/migrations/20260723130000_profiles_deleted_at.sql`
- Modify: `src/app/dashboard/actions.ts`
- Modify: `src/app/login/actions.ts`
- Create: `src/app/dashboard/settings/delete-account-section.tsx`
- Modify: `src/app/dashboard/settings/page.tsx`

- [ ] **Step 1: Migration**

`supabase/migrations/20260723130000_profiles_deleted_at.sql`:
```sql
-- Soft-delete flag for "Delete account". No row is ever physically removed —
-- this column blocks future login (checked in src/app/login/actions.ts).
alter table public.profiles add column deleted_at timestamptz;
```
`service_role` already has `update` on `profiles` (granted in
`20260720110000_grant_table_privileges.sql`) — no new grant needed.

- [ ] **Step 2: Apply and verify**

Prerequisite: Docker Desktop running.

Run:
```bash
npx supabase db reset
```
Expected: reset completes cleanly.

Run:
```bash
npx supabase db query "select column_name from information_schema.columns where table_name='profiles' and column_name='deleted_at'"
```
Expected: one row.

- [ ] **Step 3: Server Action (soft delete)**

Append to `src/app/dashboard/actions.ts`:
```ts
export type DeleteAccountResult = { ok: true } | { ok: false; error: string };

// Soft delete: flips profiles.deleted_at and signs the user out. No row in
// invoices/vendors/inboxes/auth.users is touched — see the design spec's
// "no data deletion" constraint.
export async function deleteAccount(confirmEmail: string): Promise<DeleteAccountResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Never trust a client-side enable/disable check alone for a destructive action.
  if (confirmEmail.trim().toLowerCase() !== user.email?.toLowerCase()) {
    return { ok: false, error: "Email confirmation does not match your account." };
  }

  const service = createServiceClient();
  const { error } = await service
    .from("profiles")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) {
    console.error("Failed to soft-delete account", user.id, error);
    return { ok: false, error: "Could not delete your account. Please try again." };
  }

  await supabase.auth.signOut();
  redirect("/");
}
```
(No new imports needed — `createClient`, `createServiceClient`, and `redirect` are already
imported at the top of this file.)

- [ ] **Step 4: Block login for soft-deleted accounts**

Replace `src/app/login/actions.ts` in full:
```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseLoginForm } from "@/lib/validation/auth";

export async function login(formData: FormData) {
  const parsed = parseLoginForm(formData);
  if (!parsed.success) {
    redirect(`/login?error=${encodeURIComponent(parsed.error)}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("deleted_at")
    .eq("id", user!.id)
    .maybeSingle();

  if (profile?.deleted_at) {
    await supabase.auth.signOut();
    redirect(`/login?error=${encodeURIComponent("This account has been deleted.")}`);
  }

  redirect("/dashboard");
}
```
This check only runs at login (not on every request via the session middleware) — an
already-open session on another device stays valid until its token naturally expires;
called out as a known, accepted limitation rather than fixed here (see design spec).

- [ ] **Step 5: Client component (type-to-confirm)**

`src/app/dashboard/settings/delete-account-section.tsx`:
```tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteAccount } from "../actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Trash2 } from "lucide-react";

export function DeleteAccountSection({ email }: { email: string }) {
  const [confirmEmail, setConfirmEmail] = useState("");
  const [isPending, startTransition] = useTransition();

  const canDelete = confirmEmail.trim().toLowerCase() === email.toLowerCase();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteAccount(confirmEmail);
      if (!result.ok) {
        toast.error(result.error);
      }
      // On success the action redirects — nothing else to do here.
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-muted-foreground">
        This deactivates your account and signs you out — you won't be able to sign back
        in. Your invoices and other data are kept, not erased. Type{" "}
        <span className="font-mono">{email}</span> to confirm.
      </p>
      <Input
        value={confirmEmail}
        onChange={(e) => setConfirmEmail(e.target.value)}
        placeholder={email}
        className="h-9 max-w-sm"
        aria-label="Confirm your email to delete your account"
      />
      <Button
        variant="destructive"
        size="sm"
        className="w-fit"
        disabled={!canDelete || isPending}
        onClick={handleDelete}
      >
        {isPending ? <Spinner data-icon="inline-start" /> : <Trash2 data-icon="inline-start" />}
        {isPending ? "Deleting..." : "Delete account"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 6: Add the card to the settings page**

Task 8 already put a `<div className="flex flex-col gap-4">` around the cards in
`src/app/dashboard/settings/page.tsx` — add the import at the top:
```tsx
import { DeleteAccountSection } from "./delete-account-section";
```
and this `<Card>` as a third child inside that same `<div className="flex flex-col gap-4">`,
directly after the closing `</Card>` of the "Password" card (and before the wrapping
`</div>`):
```tsx
        <Card className="rounded-[14px] border-destructive/30 shadow-none">
          <CardHeader>
            <CardTitle className="text-[13px] font-semibold text-destructive">
              Danger zone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DeleteAccountSection email={user!.email!} />
          </CardContent>
        </Card>
```

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260723130000_profiles_deleted_at.sql src/app/dashboard/actions.ts src/app/login/actions.ts src/app/dashboard/settings/delete-account-section.tsx src/app/dashboard/settings/page.tsx
git commit -m "feat: add soft-delete account deactivation (no data removed)"
```

---

## Task 10: Full verification + docs

**Files:**
- Create: `docs/system-hardening.md`

- [ ] **Step 1: Run the whole test suite**

Run: `npm run test`
Expected: all suites pass, including the new tests from Tasks 1, 3, 5, 6.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: build succeeds; route list includes `/forgot-password`, `/reset-password`,
`/auth/callback`.

- [ ] **Step 3: Manual smoke test — password recovery**

Prerequisite: local Supabase running. Run `npx supabase status` and note the Inbucket
(mail testing) URL.

1. On `/login`, click "Forgot password?" → land on `/forgot-password`.
2. Submit the seeded admin's email (`admin@local.test`) → see the "check your inbox" state.
3. Open the Inbucket URL, find the reset email, click the link.
4. Expected: redirected through `/auth/callback` to `/reset-password`.
5. Submit a new password → redirected to `/dashboard`.
6. Log out, log back in with the new password → succeeds.

- [ ] **Step 4: Manual smoke test — upload dedup**

1. Upload a PDF via the dashboard upload button → invoice appears.
2. Upload the exact same file again.
3. Expected: no second row in `/dashboard/invoices`; confirm via
   `npx supabase db query "select count(*) from invoices where content_hash is not null"`
   that the count didn't increase.

- [ ] **Step 5: Manual smoke test — invoices pagination + filter**

1. Ensure the seeded user has more than 20 invoices (insert synthetic rows via
   `npx supabase db query` if needed, then delete them after — same pattern as the
   subscription-reminders smoke test).
2. Open `/dashboard/invoices` → confirm "Page 1 of N" and exactly 20 rows.
3. Click Next → URL becomes `?page=2`, different rows load.
4. Type a vendor name in the filter → URL updates to `?vendor=...`, results narrow, page
   resets to 1.
5. Click a status filter button → URL updates to `?status=review` (or `ok`), results
   narrow accordingly.
6. Clean up any synthetic rows inserted for this test.

- [ ] **Step 6: Manual smoke test — account settings**

1. On `/dashboard/settings`, use "Update password" with a new password → toast confirms,
   log out/in with the new password to verify.
2. Create a throwaway test account (sign up with a new email), then use "Delete account"
   (type the email to confirm) → redirected to `/`.
3. Confirm via
   `npx supabase db query "select deleted_at from profiles where email = '<test email>'"`
   that `deleted_at` is now set, and separately that the user's `invoices`/`vendors` rows
   (if any) and `auth.users` row still exist — nothing was removed.
4. Try logging back in with that test account's credentials → rejected with "This account
   has been deleted.", not signed in.

- [ ] **Step 7: Write `docs/system-hardening.md`**

Record: the four features shipped, the content-hash dedup approach and why it also skips
re-extraction (cost saving), the pagination/filter scope decision (Invoices page only,
filter moved server-side, sort stays page-local — and why Overview/Vendors/Inbox are
excluded), and that account deletion is a **soft delete** — `profiles.deleted_at` blocks
login, no row anywhere is physically removed, and why (explicit no-data-deletion
constraint). Link the design spec.

- [ ] **Step 8: Final commit**

```bash
git add docs/system-hardening.md
git commit -m "docs: record system hardening features"
```

---

## File Structure Summary

**Created:**
- `src/app/forgot-password/{page.tsx,actions.ts}`
- `src/app/auth/callback/route.ts`
- `src/app/reset-password/{page.tsx,actions.ts}`
- `src/lib/file-hash.ts` + `.test.ts`
- `supabase/migrations/20260723120000_invoices_content_hash.sql`
- `src/lib/pagination.ts` + `.test.ts`
- `src/lib/invoices/query.ts` + `.test.ts`
- `src/components/dashboard/invoices-toolbar.tsx`
- `src/app/dashboard/settings/change-password-form.tsx`
- `supabase/migrations/20260723130000_profiles_deleted_at.sql`
- `src/app/dashboard/settings/delete-account-section.tsx`
- `docs/system-hardening.md`

**Modified:**
- `src/lib/validation/auth.ts` + `.test.ts`
- `src/lib/supabase/update-session.ts`
- `src/app/login/page.tsx`
- `src/app/api/invoices/upload/route.ts`
- `src/app/dashboard/invoices/page.tsx`
- `src/components/dashboard/invoices-table.tsx`
- `src/components/dashboard/columns.tsx`
- `src/app/dashboard/actions.ts`
- `src/app/login/actions.ts`
- `src/app/dashboard/settings/page.tsx`
