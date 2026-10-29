import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getInboxStatus, type InvoiceRow } from "@/lib/invoices";
import InboxPage from "./page";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/components/dashboard/inbox/inbox-view", () => ({ InboxView: () => null }));

const rows = [
  { id: "high-confidence", needs_review: false, confidence_score: 1, approved_at: null },
  { id: "low-confidence-approved", needs_review: false, confidence_score: 0.3, approved_at: "2026-10-28" },
  { id: "null-confidence", needs_review: false, confidence_score: null, approved_at: null },
  { id: "review", needs_review: true, confidence_score: 0.3, approved_at: null },
  { id: "review-overrides-approval", needs_review: true, confidence_score: 1, approved_at: "2026-10-27" },
];

beforeEach(() => {
  // The test runner compiles JSX without Next's automatic React runtime.
  vi.stubGlobal("React", React);
  const client = createSupabaseClient("http://inbox.test", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input) => {
      const p = new URL(String(input)).searchParams;
      expect(p.get("user_id")).toBe("eq.owner");
      expect(p.get("deleted_at")).toBe("is.null");
      expect(p.has("confidence_score")).toBe(false);
      let matches = rows;
      if (p.has("needs_review")) matches = matches.filter(r => r.needs_review === (p.get("needs_review") === "eq.true"));
      if (p.get("approved_at") === "not.is.null") matches = matches.filter(r => r.approved_at !== null);
      if (p.get("approved_at") === "is.null") matches = matches.filter(r => r.approved_at === null);
      return Response.json(matches, { headers: { "content-range": `0-${Math.max(0, matches.length - 1)}/${matches.length}` } });
    } },
  });
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) },
    from: client.from.bind(client),
  } as Awaited<ReturnType<typeof createClient>>);
});

afterEach(() => vi.unstubAllGlobals());

describe("Inbox filters agree with human approval badges", () => {
  it.each(["approved", "extracted", "review"] as const)("%s filter includes exactly the matching badges", async (status) => {
    const page = await InboxPage({ searchParams: Promise.resolve({ status }) });
    const invoices = page.props.invoices as InvoiceRow[];
    expect(invoices.map(r => r.id)).toEqual(rows.filter(r => getInboxStatus(r as InvoiceRow) === status).map(r => r.id));
    expect(invoices.every(r => getInboxStatus(r) === status)).toBe(true);
  });
});
