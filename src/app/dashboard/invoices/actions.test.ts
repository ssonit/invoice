import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { extractInvoice } from "@/lib/extraction";
import { checkUploadRateLimit } from "@/lib/rate-limit";
import { previewInvoiceExtraction, setInvoiceReviewStatus, updateInvoice } from "./actions";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/extraction", () => ({ extractInvoice: vi.fn() }));
vi.mock("@/lib/vendors", () => ({ ensureVendorRecord: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ checkUploadRateLimit: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(() => { throw new Error("redirect"); }) }));

const ID = "3c4f0757-64f7-49b5-ad40-7f18b91dcfd5";
const USER_ID = "owner";
const fields = { vendor: "Corrected vendor", invoice_number: "INV-1", amount: "20", currency: "USD", issue_date: "2026-10-28", due_date: "", tax: "" };
const extraction = { is_invoice: true, vendor: "AI vendor", invoice_number: "INV-1", amount: 30, currency: "USD", issue_date: "2026-10-28", due_date: null, tax: null, line_items: [{ description: "New item", quantity: 1, unit_price: 30, amount: 30 }], confidence_score: 0.99 };
let invoice: Record<string, unknown>;
let writes: Record<string, unknown>[];
let downloads: number;

beforeEach(() => {
  vi.clearAllMocks();
  invoice = { id: ID, user_id: USER_ID, deleted_at: null, file_url: `${USER_ID}/invoice.pdf`, vendor: "User correction", amount: 20, approved_at: "2026-10-27T00:00:00Z", needs_review: false, line_items: [] };
  writes = [];
  downloads = 0;
  const client = createSupabaseClient("http://invoice.test", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname.startsWith("/storage/")) {
        downloads++;
        return new Response("pdf", { headers: { "content-type": "application/pdf" } });
      }
      // Exercise the real query builder and require every privileged path to scope ownership.
      expect(url.searchParams.get("user_id")).toBe(`eq.${USER_ID}`);
      expect(url.searchParams.get("id")).toBe(`eq.${ID}`);
      expect(url.searchParams.get("deleted_at")).toBe("is.null");
      if (invoice.user_id !== USER_ID || invoice.deleted_at !== null) return Response.json([]);
      if (init?.method === "PATCH") {
        const patch = JSON.parse(String(init.body));
        writes.push(patch);
        Object.assign(invoice, patch);
      }
      return Response.json([invoice]);
    } },
  });
  vi.mocked(createServiceClient).mockReturnValue(client);
  vi.mocked(createClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: USER_ID } } }) } } as Awaited<ReturnType<typeof createClient>>);
  vi.mocked(checkUploadRateLimit).mockResolvedValue({ limited: false });
  vi.mocked(extractInvoice).mockResolvedValue({ extraction, metrics: { provider: "anthropic", model: "test", inputTokens: 1, outputTokens: 1, durationMs: 1, method: "vision" } });
});

describe("invoice review and extraction preview", () => {
  it("re-reading never overwrites saved corrections or approval", async () => {
    const original = structuredClone(invoice);
    expect(await previewInvoiceExtraction({ id: ID })).toEqual({ ok: true, extraction });
    expect(downloads).toBe(1);
    expect(writes).toEqual([]);
    expect(invoice).toEqual(original);
  });

  it("saves only after explicit review and requires a new approval", async () => {
    const preview = await previewInvoiceExtraction({ id: ID });
    expect(preview.ok).toBe(true);
    expect(await updateInvoice({ id: ID, ...fields, line_items: extraction.line_items, approved_at: "forged", needs_review: false })).toEqual({ ok: true });
    expect(invoice.vendor).toBe("Corrected vendor");
    expect(invoice.line_items).toEqual(extraction.line_items);
    expect(invoice.approved_at).toBeNull();
    expect(invoice.needs_review).toBe(true);
  });

  it("ordinary edits preserve line items", async () => {
    invoice.line_items = extraction.line_items;
    expect(await updateInvoice({ id: ID, ...fields })).toEqual({ ok: true });
    expect(writes[0]).not.toHaveProperty("line_items");
    expect(invoice.line_items).toEqual(extraction.line_items);
  });

  it.each(["foreign", "deleted"])("cannot read or modify a %s invoice", async (kind) => {
    if (kind === "foreign") invoice.user_id = "someone-else";
    else invoice.deleted_at = "2026-10-28T00:00:00Z";
    expect((await previewInvoiceExtraction({ id: ID })).ok).toBe(false);
    expect((await updateInvoice({ id: ID, ...fields })).ok).toBe(false);
    expect((await setInvoiceReviewStatus({ id: ID, status: "approved" })).ok).toBe(false);
    expect(writes).toEqual([]);
    expect(downloads).toBe(0);
    expect(extractInvoice).not.toHaveBeenCalled();
  });

  it("blocks model calls when the extraction rate limit is reached", async () => {
    vi.mocked(checkUploadRateLimit).mockResolvedValue({ limited: true, retryAfterSeconds: 30 });
    expect((await previewInvoiceExtraction({ id: ID })).ok).toBe(false);
    expect(downloads).toBe(0);
    expect(extractInvoice).not.toHaveBeenCalled();
    expect(writes).toEqual([]);
  });

  it("rejects non-invoice proposals without changing the invoice", async () => {
    vi.mocked(extractInvoice).mockResolvedValueOnce({ extraction: { ...extraction, is_invoice: false }, metrics: { provider: "anthropic", model: "test", inputTokens: 1, outputTokens: 1, durationMs: 1, method: "vision" } });
    expect((await previewInvoiceExtraction({ id: ID })).ok).toBe(false);
    expect(writes).toEqual([]);
  });

  it("records explicit approval and clears it on a review request", async () => {
    expect(await setInvoiceReviewStatus({ id: ID, status: "approved" })).toEqual({ ok: true });
    expect(invoice.needs_review).toBe(false);
    expect(invoice.approved_at).toEqual(expect.any(String));
    expect(await setInvoiceReviewStatus({ id: ID, status: "review" })).toEqual({ ok: true });
    expect(invoice.approved_at).toBeNull();
    expect(invoice.needs_review).toBe(true);
  });

  it("requires authentication for preview and saves", async () => {
    vi.mocked(createClient).mockResolvedValueOnce({ auth: { getUser: async () => ({ data: { user: null } }) } } as Awaited<ReturnType<typeof createClient>>);
    await expect(previewInvoiceExtraction({ id: ID })).rejects.toThrow("redirect");
    expect(downloads).toBe(0);
    expect(writes).toEqual([]);
  });
});
