# lib/ Unit Test Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add Vitest unit tests for the `src/lib/` pure-logic modules that currently have none, matching the project's existing test conventions.

**Architecture:** Each task adds one `*.test.ts` file next to its module, no source changes except where noted. No new dependencies or test infrastructure — same `describe`/`it`/`vi.mock` patterns already used in `src/lib/subscriptions.test.ts` and `src/lib/invoices/process-extraction.test.ts`.

**Tech Stack:** Vitest (already configured via `vitest.config.ts`).

**Design spec:** `docs/superpowers/specs/2026-07-23-lib-unit-test-coverage-design.md`

---

## Task 1: `src/lib/invoices.ts`

**Files:**
- Test: `src/lib/invoices.test.ts`

- [x] **Step 1: Write the failing tests**

`src/lib/invoices.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import {
  computeStats,
  formatInvoiceDate,
  formatInvoiceMoney,
  getInboxStatus,
  inboxGroupLabel,
  inboxTimeLabel,
  monthlyTrend,
  normalizeInvoice,
  type InvoiceRow,
} from "./invoices";

function row(overrides: Partial<InvoiceRow> = {}): InvoiceRow {
  return {
    id: "1",
    vendor: "Acme",
    invoice_number: "INV-1",
    amount: 100,
    currency: "USD",
    issue_date: "2026-07-01",
    due_date: null,
    tax: null,
    line_items: [],
    confidence_score: 0.95,
    source: "email",
    needs_review: false,
    file_url: null,
    created_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("getInboxStatus", () => {
  it("returns 'review' when needs_review is true, regardless of confidence", () => {
    expect(getInboxStatus(row({ needs_review: true, confidence_score: 0.99 }))).toBe(
      "review",
    );
  });

  it("returns 'approved' for high confidence", () => {
    expect(getInboxStatus(row({ confidence_score: 0.9 }))).toBe("approved");
  });

  it("returns 'extracted' for lower confidence that isn't flagged for review", () => {
    expect(getInboxStatus(row({ confidence_score: 0.5 }))).toBe("extracted");
  });

  it("returns 'extracted' when confidence_score is null", () => {
    expect(getInboxStatus(row({ confidence_score: null }))).toBe("extracted");
  });
});

describe("formatInvoiceMoney", () => {
  it("formats USD with 2 decimals and a $ prefix", () => {
    expect(formatInvoiceMoney(1234.5, "USD")).toBe("$1,234.50");
  });

  it("formats non-USD with 0 decimals and a currency suffix", () => {
    expect(formatInvoiceMoney(1234567, "VND")).toBe("1,234,567 VND");
  });

  it("returns an em dash for a null amount", () => {
    expect(formatInvoiceMoney(null, "USD")).toBe("—");
  });

  it("handles a null currency gracefully", () => {
    expect(formatInvoiceMoney(50, null)).toBe("50");
  });

  it("formats negative amounts with a leading minus sign", () => {
    expect(formatInvoiceMoney(-42, "USD")).toBe("$-42.00");
  });
});

describe("formatInvoiceDate", () => {
  it("formats an ISO date without a timezone shift", () => {
    expect(formatInvoiceDate("2026-07-01")).toBe("Jul 1, 2026");
  });

  it("returns an em dash for null", () => {
    expect(formatInvoiceDate(null)).toBe("—");
  });

  it("returns the raw value when it doesn't match YYYY-MM-DD", () => {
    expect(formatInvoiceDate("not-a-date")).toBe("not-a-date");
  });
});

describe("normalizeInvoice", () => {
  it("coerces numeric-string fields (as PostgREST returns them) to numbers", () => {
    const result = normalizeInvoice({
      id: "1",
      amount: "123.45",
      tax: "1.5",
      confidence_score: "0.8",
      created_at: "2026-07-01T00:00:00.000Z",
    });
    expect(result.amount).toBe(123.45);
    expect(result.tax).toBe(1.5);
    expect(result.confidence_score).toBe(0.8);
  });

  it("falls back to null for missing/empty/non-numeric amount", () => {
    expect(
      normalizeInvoice({ id: "1", amount: "", created_at: "2026-07-01T00:00:00.000Z" })
        .amount,
    ).toBeNull();
    expect(
      normalizeInvoice({
        id: "1",
        amount: "not-a-number",
        created_at: "2026-07-01T00:00:00.000Z",
      }).amount,
    ).toBeNull();
    expect(
      normalizeInvoice({ id: "1", created_at: "2026-07-01T00:00:00.000Z" }).amount,
    ).toBeNull();
  });

  it("defaults line_items to an empty array when missing or not an array", () => {
    expect(
      normalizeInvoice({ id: "1", created_at: "2026-07-01T00:00:00.000Z" }).line_items,
    ).toEqual([]);
  });

  it("normalizes line item fields, coercing numbers and defaulting description", () => {
    const result = normalizeInvoice({
      id: "1",
      created_at: "2026-07-01T00:00:00.000Z",
      line_items: [{ description: "Widget", quantity: "2", unit_price: "9.5" }],
    });
    expect(result.line_items).toEqual([
      { description: "Widget", quantity: 2, unit_price: 9.5, amount: null },
    ]);
  });

  it("defaults source to 'email' when missing", () => {
    expect(
      normalizeInvoice({ id: "1", created_at: "2026-07-01T00:00:00.000Z" }).source,
    ).toBe("email");
  });
});

describe("computeStats", () => {
  it("sums per currency and reports the currency with the largest raw sum", () => {
    // computeStats does not convert currencies — it picks whichever currency's
    // summed amount is numerically largest, so keep USD's sum above VND's here.
    const now = new Date();
    const created = now.toISOString();
    const stats = computeStats([
      row({ amount: 100, currency: "USD", created_at: created }),
      row({ amount: 50, currency: "USD", created_at: created }),
      row({ amount: 80, currency: "VND", created_at: created }),
    ]);
    expect(stats.currency).toBe("USD");
    expect(stats.totalValue).toBe(150);
    expect(stats.multiCurrency).toBe(true);
  });

  it("counts needs_review and this-month rows correctly", () => {
    const now = new Date();
    const created = now.toISOString();
    const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15)).toISOString();
    const stats = computeStats([
      row({ needs_review: true, created_at: created }),
      row({ needs_review: false, created_at: created }),
      row({ needs_review: false, created_at: lastMonth }),
    ]);
    expect(stats.needsReview).toBe(1);
    expect(stats.thisMonth).toBe(2);
    expect(stats.total).toBe(3);
  });

  it("returns null currency and false multiCurrency for an empty list", () => {
    const stats = computeStats([]);
    expect(stats.currency).toBeNull();
    expect(stats.multiCurrency).toBe(false);
    expect(stats.totalValue).toBe(0);
  });
});

describe("monthlyTrend", () => {
  it("returns `months` buckets ending on the current month, oldest first", () => {
    const trend = monthlyTrend([], 3);
    expect(trend).toHaveLength(3);
    const now = new Date();
    const currentLabel = now.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
    expect(trend[trend.length - 1]!.month).toBe(currentLabel);
  });

  it("buckets a row into its creation month", () => {
    const now = new Date();
    const trend = monthlyTrend([row({ created_at: now.toISOString() })], 3);
    expect(trend[trend.length - 1]!.count).toBe(1);
  });

  it("ignores rows older than the requested window", () => {
    const now = new Date();
    const tooOld = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1),
    ).toISOString();
    const trend = monthlyTrend([row({ created_at: tooOld })], 3);
    expect(trend.reduce((sum, b) => sum + b.count, 0)).toBe(0);
  });
});

describe("inboxGroupLabel / inboxTimeLabel", () => {
  const now = "2026-07-23T15:00:00.000Z";

  it("labels a same-day timestamp as Today", () => {
    expect(inboxGroupLabel("2026-07-23T08:00:00.000Z", now)).toBe("Today");
  });

  it("labels the previous UTC day as Yesterday", () => {
    expect(inboxGroupLabel("2026-07-22T23:00:00.000Z", now)).toBe("Yesterday");
  });

  it("labels older dates with month/day/year", () => {
    expect(inboxGroupLabel("2026-07-01T00:00:00.000Z", now)).toBe("Jul 1, 2026");
  });

  it("formats today's time as h:mm AM/PM", () => {
    expect(inboxTimeLabel("2026-07-23T08:05:00.000Z", now)).toBe("8:05 AM");
  });

  it("shows 'Yesterday' (not a time) for the previous day", () => {
    expect(inboxTimeLabel("2026-07-22T23:00:00.000Z", now)).toBe("Yesterday");
  });
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/invoices.test.ts`
Expected: FAIL (module import errors — the functions exist, but run this first to confirm the test file itself is wired correctly and fails for the right reason if any typo exists).

- [x] **Step 3: Fix any typos/mismatches against the real module and get to green**

No production code changes are expected — `src/lib/invoices.ts` already implements all of this. If a test fails on real behavior (not a typo), stop and report the discrepancy rather than changing the test to match a bug.

Run: `npx vitest run src/lib/invoices.test.ts`
Expected: PASS (all tests).

- [x] **Step 4: Commit**

```bash
git add src/lib/invoices.test.ts
git commit -m "test: add unit tests for src/lib/invoices.ts"
```

---

## Task 2: `src/lib/vendors/query.ts`

**Files:**
- Test: `src/lib/vendors/query.test.ts`

- [x] **Step 1: Write the failing tests**

`src/lib/vendors/query.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import {
  escapeIlike,
  isDefaultVendorQuery,
  parseVendorQuery,
  vendorFilterLabel,
  vendorSortLabel,
} from "./query";
import { VENDOR_FILTER, VENDOR_SORT } from "@/constants/vendors";

describe("parseVendorQuery", () => {
  it("falls back to defaults for missing params", () => {
    expect(parseVendorQuery({})).toEqual({
      q: "",
      filter: VENDOR_FILTER.ALL,
      sort: VENDOR_SORT.TOTAL_DESC,
    });
  });

  it("trims and length-caps the search query", () => {
    const result = parseVendorQuery({ q: "  acme  " });
    expect(result.q).toBe("acme");
  });

  it("truncates an overly long search query to VENDOR_SEARCH_MAX_LENGTH", () => {
    const result = parseVendorQuery({ q: "a".repeat(500) });
    expect(result.q).toHaveLength(100);
  });

  it("accepts a known filter and sort value", () => {
    const result = parseVendorQuery({
      filter: VENDOR_FILTER.SUBSCRIPTION,
      sort: VENDOR_SORT.NAME_ASC,
    });
    expect(result.filter).toBe(VENDOR_FILTER.SUBSCRIPTION);
    expect(result.sort).toBe(VENDOR_SORT.NAME_ASC);
  });

  it("falls back to the default filter/sort for unknown values", () => {
    const result = parseVendorQuery({ filter: "bogus", sort: "bogus" });
    expect(result.filter).toBe(VENDOR_FILTER.ALL);
    expect(result.sort).toBe(VENDOR_SORT.TOTAL_DESC);
  });
});

describe("escapeIlike", () => {
  it("escapes backslash, percent, and underscore", () => {
    expect(escapeIlike("100%_off\\deal")).toBe("100\\%\\_off\\\\deal");
  });

  it("leaves ordinary text unchanged", () => {
    expect(escapeIlike("Acme SaaS")).toBe("Acme SaaS");
  });

  it("escapes the backslash first so it doesn't double-escape later substitutions", () => {
    // A literal backslash followed by a percent should become \\ + \%, not \\%.
    expect(escapeIlike("\\%")).toBe("\\\\\\%");
  });
});

describe("isDefaultVendorQuery", () => {
  it("is true for the default query shape", () => {
    expect(
      isDefaultVendorQuery({ q: "", filter: VENDOR_FILTER.ALL, sort: VENDOR_SORT.TOTAL_DESC }),
    ).toBe(true);
  });

  it("is false when q is non-empty", () => {
    expect(
      isDefaultVendorQuery({
        q: "acme",
        filter: VENDOR_FILTER.ALL,
        sort: VENDOR_SORT.TOTAL_DESC,
      }),
    ).toBe(false);
  });

  it("is false when filter or sort differs from the default", () => {
    expect(
      isDefaultVendorQuery({
        q: "",
        filter: VENDOR_FILTER.CANCELLED,
        sort: VENDOR_SORT.TOTAL_DESC,
      }),
    ).toBe(false);
  });
});

describe("label lookups", () => {
  it("returns the display label for a filter and sort value", () => {
    expect(vendorFilterLabel(VENDOR_FILTER.CANCELLED)).toBe("Cancelled");
    expect(vendorSortLabel(VENDOR_SORT.NAME_ASC)).toBe("Name (A → Z)");
  });
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/vendors/query.test.ts`
Expected: FAIL initially (verify the file is wired up), in particular double-check the `escapeIlike` order-of-replacement expectation against the real implementation (`.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")` — backslash first, so a literal `\%` input becomes `\\` + `%`→`\%`, i.e. `\\\%`).

- [x] **Step 3: Get to green**

No production code changes expected.

Run: `npx vitest run src/lib/vendors/query.test.ts`
Expected: PASS (all tests).

- [x] **Step 4: Commit**

```bash
git add src/lib/vendors/query.test.ts
git commit -m "test: add unit tests for src/lib/vendors/query.ts"
```

---

## Task 3: `src/lib/validation/vendors.ts`

**Files:**
- Test: `src/lib/validation/vendors.test.ts`

- [x] **Step 1: Write the failing tests**

`src/lib/validation/vendors.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import {
  parseCreateVendorInput,
  parseDeleteVendorInput,
  parseUpdateVendorInput,
} from "./vendors";

describe("parseCreateVendorInput", () => {
  it("accepts a valid name with no notes", () => {
    const result = parseCreateVendorInput({ name: "Acme SaaS" });
    expect(result).toEqual({ success: true, data: { name: "Acme SaaS", notes: null } });
  });

  it("trims the name and keeps trimmed notes", () => {
    const result = parseCreateVendorInput({ name: "  Acme  ", notes: "  hello  " });
    expect(result).toEqual({ success: true, data: { name: "Acme", notes: "hello" } });
  });

  it("converts empty-after-trim notes to null", () => {
    const result = parseCreateVendorInput({ name: "Acme", notes: "   " });
    expect(result).toEqual({ success: true, data: { name: "Acme", notes: null } });
  });

  it("rejects an empty name", () => {
    expect(parseCreateVendorInput({ name: "" }).success).toBe(false);
  });

  it("rejects a name over 200 characters", () => {
    expect(parseCreateVendorInput({ name: "a".repeat(201) }).success).toBe(false);
  });

  it("rejects notes over 1000 characters", () => {
    expect(
      parseCreateVendorInput({ name: "Acme", notes: "a".repeat(1001) }).success,
    ).toBe(false);
  });
});

describe("parseUpdateVendorInput", () => {
  const validId = "123e4567-e89b-12d3-a456-426614174000";

  it("accepts a valid id + name", () => {
    const result = parseUpdateVendorInput({ id: validId, name: "Acme" });
    expect(result.success).toBe(true);
  });

  it("rejects a non-uuid id", () => {
    expect(parseUpdateVendorInput({ id: "not-a-uuid", name: "Acme" }).success).toBe(
      false,
    );
  });

  it("rejects an empty name", () => {
    expect(parseUpdateVendorInput({ id: validId, name: "" }).success).toBe(false);
  });
});

describe("parseDeleteVendorInput", () => {
  const validId = "123e4567-e89b-12d3-a456-426614174000";

  it("accepts a valid uuid", () => {
    expect(parseDeleteVendorInput({ id: validId })).toEqual({
      success: true,
      data: { id: validId },
    });
  });

  it("rejects a missing id", () => {
    expect(parseDeleteVendorInput({}).success).toBe(false);
  });

  it("rejects a non-uuid id", () => {
    expect(parseDeleteVendorInput({ id: "123" }).success).toBe(false);
  });
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/validation/vendors.test.ts`
Expected: FAIL initially (confirms wiring); no bugs expected in the source.

- [x] **Step 3: Get to green**

Run: `npx vitest run src/lib/validation/vendors.test.ts`
Expected: PASS (all tests).

- [x] **Step 4: Commit**

```bash
git add src/lib/validation/vendors.test.ts
git commit -m "test: add unit tests for src/lib/validation/vendors.ts"
```

---

## Task 4: `src/lib/vendors.ts` (`ensureVendorRecord`)

**Files:**
- Test: `src/lib/vendors.test.ts`

- [x] **Step 1: Write the failing tests**

`src/lib/vendors.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import { ensureVendorRecord } from "./vendors";

function mockClient(error: { message: string } | null = null) {
  const upsert = vi.fn().mockResolvedValue({ error });
  const from = vi.fn().mockReturnValue({ upsert });
  return { client: { from }, from, upsert };
}

describe("ensureVendorRecord", () => {
  it("upserts on (user_id, name_key) with ignoreDuplicates", async () => {
    const { client, from, upsert } = mockClient();
    await ensureVendorRecord(client, "user-1", "Acme SaaS");
    expect(from).toHaveBeenCalledWith("vendors");
    const [row, options] = upsert.mock.calls[0]!;
    expect(row).toMatchObject({ user_id: "user-1", name: "Acme SaaS", name_key: "acme saas" });
    expect(options).toEqual({ onConflict: "user_id,name_key", ignoreDuplicates: true });
  });

  it("trims the name before storing it", async () => {
    const { client, upsert } = mockClient();
    await ensureVendorRecord(client, "user-1", "  Acme  ");
    expect(upsert.mock.calls[0]![0]).toMatchObject({ name: "Acme" });
  });

  it("is a no-op for null, undefined, or blank vendor names", async () => {
    const { client, from } = mockClient();
    await ensureVendorRecord(client, "user-1", null);
    await ensureVendorRecord(client, "user-1", undefined);
    await ensureVendorRecord(client, "user-1", "   ");
    expect(from).not.toHaveBeenCalled();
  });

  it("does not throw when the upsert returns an error", async () => {
    const { client } = mockClient({ message: "boom" });
    await expect(ensureVendorRecord(client, "user-1", "Acme")).resolves.toBeUndefined();
  });
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/vendors.test.ts`
Expected: FAIL initially (confirms wiring).

- [x] **Step 3: Get to green**

Run: `npx vitest run src/lib/vendors.test.ts`
Expected: PASS (all tests).

- [x] **Step 4: Commit**

```bash
git add src/lib/vendors.test.ts
git commit -m "test: add unit tests for src/lib/vendors.ts"
```

---

## Task 5: `src/lib/agentmail.ts`

Requires mocking the `agentmail` module's default-exported client instance. Because
`src/lib/agentmail.ts` constructs its own `agentmail` client at import time from
`AgentMailClient`, the test mocks the `agentmail` package itself (`vi.mock("agentmail")`)
so the module under test picks up the mocked client transparently.

**Files:**
- Test: `src/lib/agentmail.test.ts`

- [x] **Step 1: Write the failing tests**

`src/lib/agentmail.test.ts`:

Two wiring details that aren't obvious until you run it: (1) `agentmail.ts` has a
top-level `import "server-only"`, which throws outside the Next.js bundler unless also
mocked; (2) `vi.mock` factories are hoisted above the file, so any value the factory
closes over (the mock fns, the error class) must be declared via `vi.hoisted()`, not as
plain top-level `const`s; (3) `AgentMailClient` is called with `new`, so its mock must be
a real constructor (a `class`) — an arrow function passed to `mockImplementation` cannot
be invoked with `new` and throws `TypeError: ... is not a constructor`.

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { mockCreate, mockList, MockIsTakenError } = vi.hoisted(() => {
  class MockIsTakenError extends Error {}
  return { mockCreate: vi.fn(), mockList: vi.fn(), MockIsTakenError };
});

vi.mock("agentmail", () => ({
  AgentMailClient: class {
    inboxes = { create: mockCreate, list: mockList };
  },
  AgentMail: { IsTakenError: MockIsTakenError },
}));

import { createUserInbox } from "./agentmail";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createUserInbox", () => {
  it("creates a new inbox with a deterministic username and metadata", async () => {
    mockCreate.mockResolvedValue({ email: "inv-12345678@agentmail.to" });
    const result = await createUserInbox("12345678-aaaa-bbbb-cccc-000000000000");
    expect(mockCreate).toHaveBeenCalledWith({
      username: "inv-12345678",
      metadata: { user_id: "12345678-aaaa-bbbb-cccc-000000000000" },
    });
    expect(result).toEqual({ email: "inv-12345678@agentmail.to" });
  });

  it("falls back to the existing inbox (matched by metadata) when the username is taken", async () => {
    mockCreate.mockRejectedValue(new MockIsTakenError("taken"));
    mockList.mockResolvedValue({
      inboxes: [
        { email: "inv-12345678@agentmail.to", metadata: { user_id: "user-1" } },
        { email: "other@agentmail.to", metadata: {} },
      ],
    });
    const result = await createUserInbox("user-1");
    expect(result).toEqual({
      email: "inv-12345678@agentmail.to",
      metadata: { user_id: "user-1" },
    });
  });

  it("falls back to matching by email prefix when no metadata match exists", async () => {
    mockCreate.mockRejectedValue(new MockIsTakenError("taken"));
    mockList.mockResolvedValue({
      inboxes: [{ email: "inv-abcdefgh@agentmail.to", metadata: {} }],
    });
    const result = await createUserInbox("abcdefgh-xxxx");
    expect(result).toEqual({ email: "inv-abcdefgh@agentmail.to", metadata: {} });
  });

  it("re-throws IsTakenError when no matching existing inbox can be found", async () => {
    mockCreate.mockRejectedValue(new MockIsTakenError("taken"));
    mockList.mockResolvedValue({ inboxes: [] });
    await expect(createUserInbox("user-1")).rejects.toBeInstanceOf(MockIsTakenError);
  });

  it("re-throws non-IsTakenError errors without attempting a fallback lookup", async () => {
    mockCreate.mockRejectedValue(new Error("network error"));
    await expect(createUserInbox("user-1")).rejects.toThrow("network error");
    expect(mockList).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/agentmail.test.ts`
Expected: FAIL initially — get the mock wiring right first (in particular, confirm `src/lib/agentmail.ts` imports `AgentMailClient` and `AgentMail` from `"agentmail"` exactly as mocked; adjust the mock shape if the real import differs).

- [x] **Step 3: Get to green**

Run: `npx vitest run src/lib/agentmail.test.ts`
Expected: PASS (all tests). No production code changes expected.

- [x] **Step 4: Commit**

```bash
git add src/lib/agentmail.test.ts
git commit -m "test: add unit tests for src/lib/agentmail.ts"
```

---

## Task 6: `src/lib/nav-config.ts`

**Files:**
- Test: `src/lib/nav-config.test.ts`

- [x] **Step 1: Write the failing tests**

`src/lib/nav-config.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { findNavItem, isNavItemActive } from "./nav-config";

describe("isNavItemActive", () => {
  it("requires an exact match for the dashboard root", () => {
    expect(isNavItemActive("/dashboard", "/dashboard")).toBe(true);
    expect(isNavItemActive("/dashboard/invoices", "/dashboard")).toBe(false);
  });

  it("matches nested routes by prefix", () => {
    expect(isNavItemActive("/dashboard/vendors", "/dashboard/vendors")).toBe(true);
    expect(isNavItemActive("/dashboard/vendors/123", "/dashboard/vendors")).toBe(true);
  });

  it("does not match an unrelated route that merely starts with the same string", () => {
    expect(isNavItemActive("/dashboard/vendors-extra", "/dashboard/vendors")).toBe(false);
  });
});

describe("findNavItem", () => {
  it("finds the nav item matching the current path", () => {
    expect(findNavItem("/dashboard/vendors")?.href).toBe("/dashboard/vendors");
  });

  it("returns undefined for a path with no match", () => {
    expect(findNavItem("/nowhere")).toBeUndefined();
  });

  it("picks the longest matching href when routes could nest", () => {
    // /dashboard/vendors/123 matches both "/dashboard" (if it were a prefix,
    // which it isn't per isNavItemActive) and "/dashboard/vendors" — longest wins.
    expect(findNavItem("/dashboard/vendors/123")?.href).toBe("/dashboard/vendors");
  });
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/nav-config.test.ts`
Expected: FAIL initially (confirms wiring).

- [x] **Step 3: Get to green**

Run: `npx vitest run src/lib/nav-config.test.ts`
Expected: PASS (all tests).

- [x] **Step 4: Commit**

```bash
git add src/lib/nav-config.test.ts
git commit -m "test: add unit tests for src/lib/nav-config.ts"
```

---

## Task 7: Full verification

- [x] **Step 1: Run the whole suite**

Run: `npm run test`
Expected: all suites pass (existing 7 files + 6 new ones = 13 test files).

- [x] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [x] **Step 3: Coverage sanity check (optional but recommended)**

Run: `npm run test:coverage`
Expected: `src/lib/invoices.ts`, `src/lib/vendors/query.ts`, `src/lib/validation/vendors.ts`, `src/lib/vendors.ts`, `src/lib/agentmail.ts`, and `src/lib/nav-config.ts` all show non-zero coverage.

---

## File Structure Summary

**Created (all test-only, no production code changes expected):**
- `src/lib/invoices.test.ts`
- `src/lib/vendors/query.test.ts`
- `src/lib/validation/vendors.test.ts`
- `src/lib/vendors.test.ts`
- `src/lib/agentmail.test.ts`
- `src/lib/nav-config.test.ts`
