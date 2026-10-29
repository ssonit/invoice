import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { GET } from "./route";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const USER_ID = "export-user";
let source: Record<string, unknown>[];
let requests: URL[];
let serverCap: number;
let failOffset: number | undefined;

beforeEach(() => {
  source = [];
  requests = [];
  serverCap = 1_000;
  failOffset = undefined;
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-28T12:00:00Z"));

  const client = createSupabaseClient("http://export.test", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input) => {
        const url = new URL(String(input));
        requests.push(url);
        const p = url.searchParams;
        expect(p.get("user_id")).toBe(`eq.${USER_ID}`);
        expect(p.get("deleted_at")).toBe("is.null");
        expect(p.get("order")).toBe("created_at.desc,id.desc");
        const offset = Number(p.get("offset") ?? 0);
        if (offset === failOffset) {
          return Response.json({ message: "Database unavailable" }, { status: 500 });
        }
        let rows = source;
        if (p.has("or")) {
          expect(p.get("or")).toBe(
            "(issue_date.gte.2026-05-01,and(issue_date.is.null,created_at.gte.2026-05-01T00:00:00.000Z))",
          );
          rows = rows.filter((r) => String(r.issue_date ?? r.created_at) >= "2026-05-01");
        }
        if (p.has("needs_review")) {
          rows = rows.filter((r) => r.needs_review === (p.get("needs_review") === "eq.true"));
        }
        const limit = Math.min(Number(p.get("limit")), serverCap);
        return Response.json(rows.slice(offset, offset + limit));
      },
    },
  });
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: USER_ID } } }) },
    from: client.from.bind(client),
  } as unknown as Awaited<ReturnType<typeof createClient>>);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function seed(count: number) {
  source = Array.from({ length: count }, (_, i) => ({
    id: `invoice-${i}`,
    vendor: `Vendor ${i}`,
    created_at: "2026-10-28T00:00:00Z",
    issue_date: null,
    amount: 10,
    currency: "USD",
    needs_review: false,
  }));
}

function request(query = "range=all") {
  return GET(new Request(`http://localhost/api/exports/invoices?${query}`));
}

describe("invoice CSV export", () => {
  it("exports beyond the server row cap without dropping or repeating rows", async () => {
    seed(1_205);
    serverCap = 200;
    const response = await request();
    const csv = await response.text();
    expect(response.status).toBe(200);
    expect(csv.trim().split("\n")).toHaveLength(1_206);
    expect(csv).toContain("Vendor 1204,");
    expect(response.headers.has("X-Export-Truncated")).toBe(false);
    expect(requests.length).toBeGreaterThan(1);
  });

  it.each([5_000, 5_001])("detects truncation accurately with %i matches", async (count) => {
    seed(count);
    const response = await request();
    const csv = await response.text();
    expect(response.headers.has("X-Export-Truncated")).toBe(count > 5_000);
    expect(csv).toContain("Vendor 4999,");
    expect(csv).not.toContain("Vendor 5000,");
    expect(csv.trim().split("\n")).toHaveLength(count > 5_000 ? 5_002 : 5_001);
  });

  it("filters by effective date and status before taking export slots", async () => {
    seed(5_002);
    source.forEach((r) => { r.issue_date = "2025-01-01"; });
    source[5_000] = { ...source[5_000], issue_date: "2026-05-01", needs_review: true };
    source[5_001] = { ...source[5_001], issue_date: null, needs_review: true };
    const response = await request("range=6&status=review");
    const csv = await response.text();
    expect(csv.trim().split("\n")).toHaveLength(3);
    expect(csv).toContain("Vendor 5000,");
    expect(csv).toContain("Vendor 5001,");
    expect(response.headers.has("X-Export-Truncated")).toBe(false);
  });

  it("returns an error instead of silently downloading a partial export", async () => {
    seed(600);
    failOffset = 500;
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await request();
    expect(response.status).toBe(500);
    expect(response.headers.has("Content-Disposition")).toBe(false);
  });

  it("requires a signed-in user before querying invoices", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: null } }) },
    } as unknown as Awaited<ReturnType<typeof createClient>>);
    expect((await request()).status).toBe(401);
    expect(requests).toHaveLength(0);
  });
});
