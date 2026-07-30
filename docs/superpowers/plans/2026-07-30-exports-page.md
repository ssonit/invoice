# Exports Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/dashboard/exports` as a CSV download flow: filter invoices by range/status, build CSV in pure lib helpers, serve via a Route Handler — replacing the ComingSoon placeholder.

**Architecture:** Server Component reads a matching count from Supabase, renders filter controls + download link. The download link hits `GET /api/exports/invoices` which auths via session cookie, fetches invoices with filters applied (capped at 5,000), converts to CSV via pure lib, and returns as `text/csv` attachment.

**Tech Stack:** Next.js 16 App Router (React 19 Server Components), Supabase JS, Tailwind v4 + shadcn-style UI, Vitest.

**Spec:** [`docs/superpowers/specs/2026-07-30-exports-page-design.md`](../specs/2026-07-30-exports-page-design.md)

---

## File Structure

| File | Created / Modified | Responsibility |
| --- | --- | --- |
| `src/lib/exports/query.ts` | Create | `ExportQuery`, `parseExportQuery`, `buildExportHref`, `rangeStartIso` |
| `src/lib/exports/query.test.ts` | Create | Parse valid/invalid range+status, href output, range start date math |
| `src/lib/exports/csv.ts` | Create | `CSV_COLUMNS`, `escapeCsvCell`, `invoicesToCsv` |
| `src/lib/exports/csv.test.ts` | Create | BOM header, RFC escaping, row mapping, empty input |
| `src/app/api/exports/invoices/route.ts` | Create | Auth check, filter, cap, CSV response |
| `src/components/dashboard/exports/exports-panel.tsx` | Create | Filter controls + download CTA + empty/capped copy |
| `src/app/dashboard/exports/page.tsx` | Modify | Replace ComingSoon with real page |
| `src/lib/nav-config.ts` | Modify | Exports status `"soon"` → `"live"` |

---

## Task 1: Exports query module (TDD)

**Files:**
- Create: `src/lib/exports/query.ts`
- Test: `src/lib/exports/query.test.ts`

- [ ] **Step 1: Write the failing test for `parseExportQuery`**

`src/lib/exports/query.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseExportQuery, buildExportHref, rangeStartIso } from "./query";

describe("parseExportQuery", () => {
  it("defaults to range=6, status=all when no params", () => {
    expect(parseExportQuery({})).toEqual({ range: 6, status: "all" });
  });

  it("parses valid range=12", () => {
    expect(parseExportQuery({ range: "12" })).toEqual({ range: 12, status: "all" });
  });

  it("parses range=all", () => {
    expect(parseExportQuery({ range: "all" })).toEqual({ range: "all", status: "all" });
  });

  it("parses valid status=review", () => {
    expect(parseExportQuery({ status: "review" })).toEqual({ range: 6, status: "review" });
  });

  it("parses valid status=ok", () => {
    expect(parseExportQuery({ status: "ok" })).toEqual({ range: 6, status: "ok" });
  });

  it("falls back to defaults for invalid range", () => {
    expect(parseExportQuery({ range: "3" })).toEqual({ range: 6, status: "all" });
    expect(parseExportQuery({ range: "abc" })).toEqual({ range: 6, status: "all" });
  });

  it("falls back to all for invalid status", () => {
    expect(parseExportQuery({ status: "pending" })).toEqual({ range: 6, status: "all" });
  });
});

describe("buildExportHref", () => {
  it("returns bare path for default query", () => {
    expect(buildExportHref({ range: 6, status: "all" })).toBe("/api/exports/invoices");
  });

  it("includes range=12 when non-default", () => {
    expect(buildExportHref({ range: 12, status: "all" })).toBe("/api/exports/invoices?range=12");
  });

  it("includes status=review when non-default", () => {
    expect(buildExportHref({ range: 6, status: "review" })).toBe("/api/exports/invoices?status=review");
  });

  it("includes both range=12 and status=ok", () => {
    expect(buildExportHref({ range: 12, status: "ok" })).toBe("/api/exports/invoices?range=12&status=ok");
  });

  it("includes both range=all and status=review", () => {
    expect(buildExportHref({ range: "all", status: "review" })).toBe("/api/exports/invoices?range=all&status=review");
  });
});

describe("rangeStartIso", () => {
  it("returns first-of-month ISO 6 months ago", () => {
    const now = new Date("2026-07-15T12:00:00Z");
    expect(rangeStartIso(now, 6)).toBe("2026-01-01T00:00:00.000Z");
  });

  it("returns first-of-month ISO 12 months ago", () => {
    const now = new Date("2026-07-15T12:00:00Z");
    expect(rangeStartIso(now, 12)).toBe("2025-07-01T00:00:00.000Z");
  });

  it("handles January boundary", () => {
    const now = new Date("2026-01-15T12:00:00Z");
    expect(rangeStartIso(now, 6)).toBe("2025-07-01T00:00:00.000Z");
  });
});
```

- [ ] **Step 2: Implement `parseExportQuery`, `buildExportHref`, `rangeStartIso`**

`src/lib/exports/query.ts`:

```ts
export type ExportRange = 6 | 12 | "all";

export type ExportStatus = "all" | "review" | "ok";

export type ExportQuery = {
  range: ExportRange;
  status: ExportStatus;
};

const DEFAULT_RANGE: ExportRange = 6;
const DEFAULT_STATUS: ExportStatus = "all";

const RANGE_VALUES = new Set<string>(["6", "12", "all"]);
const STATUS_VALUES = new Set<string>(["all", "review", "ok"]);

export function parseExportQuery(params: {
  range?: string;
  status?: string;
}): ExportQuery {
  const rawRange = params.range ?? "";
  const range: ExportRange = RANGE_VALUES.has(rawRange)
    ? (Number(rawRange) || rawRange) as ExportRange
    : DEFAULT_RANGE;

  const rawStatus = params.status ?? "";
  const status: ExportStatus = STATUS_VALUES.has(rawStatus)
    ? rawStatus as ExportStatus
    : DEFAULT_STATUS;

  return { range, status };
}

export function buildExportHref(query: ExportQuery): string {
  const params = new URLSearchParams();
  if (query.range !== DEFAULT_RANGE) params.set("range", String(query.range));
  if (query.status !== DEFAULT_STATUS) params.set("status", query.status);
  const qs = params.toString();
  return qs ? `/api/exports/invoices?${qs}` : "/api/exports/invoices";
}

/** First-of-month UTC ISO string `months` months ago. */
export function rangeStartIso(now: Date, months: number): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString();
}
```

- [ ] **Step 3: `npm run test -- src/lib/exports/query` → green**

---

## Task 2: Exports CSV module (TDD)

**Files:**
- Create: `src/lib/exports/csv.ts`
- Test: `src/lib/exports/csv.test.ts`

- [ ] **Step 1: Write the failing test for `escapeCsvCell` and `invoicesToCsv`**

`src/lib/exports/csv.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { escapeCsvCell, invoicesToCsv, CSV_COLUMNS } from "./csv";
import type { InvoiceRow } from "@/lib/invoices";
import { normalizeInvoice } from "@/lib/invoices";

describe("escapeCsvCell", () => {
  it("returns stringified value as-is for simple values", () => {
    expect(escapeCsvCell("hello")).toBe("hello");
    expect(escapeCsvCell(123)).toBe("123");
    expect(escapeCsvCell(0)).toBe("0");
    expect(escapeCsvCell(true)).toBe("true");
  });

  it("wraps values with commas in double quotes", () => {
    expect(escapeCsvCell("Acme, Inc.")).toBe('"Acme, Inc."');
  });

  it("escapes double quotes by doubling", () => {
    expect(escapeCsvCell('5" pipe')).toBe('"5"" pipe"');
  });

  it("wraps values with newlines in double quotes", () => {
    expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
    expect(escapeCsvCell("line1\r\nline2")).toBe('"line1\r\nline2"');
  });

  it("handles null and undefined as empty string", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
  });
});

describe("invoicesToCsv", () => {
  it("starts with UTF-8 BOM", () => {
    const csv = invoicesToCsv([]);
    expect(csv.startsWith("﻿")).toBe(true);
  });

  it("includes header row matching CSV_COLUMNS", () => {
    const csv = invoicesToCsv([]);
    const lines = csv.split("\n");
    const header = CSV_COLUMNS.map((c) => escapeCsvCell(c.label)).join(",");
    expect(lines[0]).toBe("﻿" + header);
  });

  it("maps invoice rows to CSV columns", () => {
    const row = normalizeInvoice({
      id: "1",
      vendor: "Acme Corp",
      invoice_number: "INV-001",
      amount: 1500000,
      currency: "VND",
      issue_date: "2026-07-01",
      due_date: "2026-08-01",
      tax: 150000,
      source: "email",
      needs_review: false,
      confidence_score: 0.95,
      created_at: "2026-07-15T10:30:00Z",
    });

    const csv = invoicesToCsv([row]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(3); // BOM-header, data, trailing empty
    const data = lines[1];
    expect(data).toContain("Acme Corp");
    expect(data).toContain("INV-001");
    expect(data).toContain("1500000");
    expect(data).toContain("VND");
    expect(data).toContain("2026-07-01");
    expect(data).toContain("2026-08-01");
    expect(data).toContain("150000");
    expect(data).toContain("email");
    expect(data).toContain("false");
    expect(data).toContain("0.95");
    expect(data).toContain("2026-07-15T10:30:00Z");
  });

  it("handles vendor with comma — quoted", () => {
    const row = normalizeInvoice({
      id: "1",
      vendor: "Acme, Inc.",
      invoice_number: null,
      amount: null,
      currency: null,
      issue_date: null,
      due_date: null,
      tax: null,
      source: "upload",
      needs_review: true,
      confidence_score: null,
      created_at: "2026-07-15T10:30:00Z",
    });

    const csv = invoicesToCsv([row]);
    expect(csv).toContain('"Acme, Inc."');
  });

  it("returns only BOM + header for empty rows", () => {
    const csv = invoicesToCsv([]);
    const lines = csv.trim().split("\n");
    expect(lines).toHaveLength(1); // just the BOM + header
  });

  it("each data row has the same number of columns as the header", () => {
    const rows = [
      normalizeInvoice({ id: "1", vendor: "A", invoice_number: null, amount: null, currency: null, issue_date: null, due_date: null, tax: null, source: "email", needs_review: false, confidence_score: null, created_at: "2026-01-01" }),
      normalizeInvoice({ id: "2", vendor: "B", invoice_number: null, amount: null, currency: null, issue_date: null, due_date: null, tax: null, source: "upload", needs_review: true, confidence_score: null, created_at: "2026-02-01" }),
    ];

    const csv = invoicesToCsv(rows);
    const lines = csv.trim().split("\n");
    const headerCols = lines[0].replace("﻿", "").split(",").length;
    for (let i = 1; i < lines.length; i++) {
      // Use a simple CSV-aware split for the test — count by scanning
      expect(lines[i].split(",").length).toBe(headerCols);
    }
  });
});
```

- [ ] **Step 2: Implement `CSV_COLUMNS`, `escapeCsvCell`, `invoicesToCsv`**

`src/lib/exports/csv.ts`:

```ts
import type { InvoiceRow } from "@/lib/invoices";

export const CSV_COLUMNS = [
  { key: "vendor", label: "Vendor" },
  { key: "invoice_number", label: "Invoice Number" },
  { key: "amount", label: "Amount" },
  { key: "currency", label: "Currency" },
  { key: "issue_date", label: "Issue Date" },
  { key: "due_date", label: "Due Date" },
  { key: "tax", label: "Tax" },
  { key: "source", label: "Source" },
  { key: "needs_review", label: "Needs Review" },
  { key: "confidence_score", label: "Confidence Score" },
  { key: "created_at", label: "Created At" },
] as const;

const BOM = "﻿";

/** RFC 4180 — wrap in double quotes and double any internal quotes when the
 *  value contains a comma, double quote, or newline. */
export function escapeCsvCell(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function invoicesToCsv(rows: InvoiceRow[]): string {
  const header = CSV_COLUMNS.map((c) => escapeCsvCell(c.label)).join(",");
  const dataLines = rows.map((row) =>
    CSV_COLUMNS.map((col) => {
      const value = row[col.key as keyof InvoiceRow];
      return escapeCsvCell(value);
    }).join(","),
  );
  return BOM + [header, ...dataLines].join("\n") + "\n";
}
```

- [ ] **Step 3: `npm run test -- src/lib/exports/csv` → green**

---

## Task 3: Exports API Route Handler

**Files:**
- Create: `src/app/api/exports/invoices/route.ts`

- [ ] **Step 1: Build `GET /api/exports/invoices`**

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseExportQuery, rangeStartIso } from "@/lib/exports/query";
import { invoicesToCsv } from "@/lib/exports/csv";
import { normalizeInvoice, type InvoiceRow } from "@/lib/invoices";
import { effectiveInvoiceDate } from "@/lib/analytics/report";

const MAX_EXPORT_ROWS = 5_000;

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = parseExportQuery({
    range: searchParams.get("range") ?? undefined,
    status: searchParams.get("status") ?? undefined,
  });

  let dbQuery = supabase
    .from("invoices")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(MAX_EXPORT_ROWS);

  // Apply date window unless range is "all"
  if (query.range !== "all") {
    const start = rangeStartIso(new Date(), query.range);
    dbQuery = dbQuery.or(`issue_date.gte.${start},created_at.gte.${start}`);
  }

  // Apply status filter
  if (query.status === "review") {
    dbQuery = dbQuery.eq("needs_review", true);
  } else if (query.status === "ok") {
    dbQuery = dbQuery.eq("needs_review", false);
  }

  const { data } = await dbQuery;

  const allRows = (data ?? []).map(normalizeInvoice);

  // Post-filter by effective date when range is set (same as Analytics)
  let rows = allRows;
  if (query.range !== "all") {
    const startDate = new Date(rangeStartIso(new Date(), query.range));
    rows = allRows.filter((row) => effectiveInvoiceDate(row) >= startDate);
  }

  const csv = invoicesToCsv(rows);

  const dateStr = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="invoices-${dateStr}.csv"`,
    },
  });
}
```

- [ ] **Step 2: Verify route compiles with `npx tsc --noEmit`**

---

## Task 4: Exports page UI

**Files:**
- Create: `src/components/dashboard/exports/exports-panel.tsx`
- Modify: `src/app/dashboard/exports/page.tsx`

- [ ] **Step 1: Build `ExportsPanel` client component**

URL-driven filter toggles + download link + count display + empty state.

- [ ] **Step 2: Replace `src/app/dashboard/exports/page.tsx`**

RSC page: parse query, count matching rows from Supabase, render `ExportsPanel` inside `ContentShell`.

- [ ] **Step 3: Smoke test in dev server**

---

## Task 5: Nav config live

**Files:**
- Modify: `src/lib/nav-config.ts`

- [ ] **Step 1: Flip Exports `status: "soon"` → `status: "live"`**

---

## Verification Gates

- [ ] `npm run test` — all tests green
- [ ] `npx tsc --noEmit` — clean
- [ ] `npm run build` — successful
- [ ] Manual smoke: CSV downloads and opens in Excel/Sheets; empty filter shows empty state; cap messaging when > 5,000 rows
