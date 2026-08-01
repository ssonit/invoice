import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/extraction", () => ({ extractInvoice: vi.fn() }));
vi.mock("@/lib/vendors", () => ({ ensureVendorRecord: vi.fn() }));
vi.mock("@/lib/billing/usage", () => ({ checkStarterQuota: vi.fn() }));

import { extractInvoice } from "@/lib/extraction";
import { ensureVendorRecord } from "@/lib/vendors";
import { checkStarterQuota } from "@/lib/billing/usage";
import { processExtraction } from "./process-extraction";

const mockedExtract = vi.mocked(extractInvoice);
const mockedCheckQuota = vi.mocked(checkStarterQuota);

function invoiceResult(overrides: Record<string, unknown> = {}) {
  return {
    is_invoice: true,
    vendor: "Acme SaaS",
    invoice_number: "INV-1",
    amount: 19,
    currency: "USD",
    issue_date: "2026-07-01",
    due_date: null,
    tax: null,
    line_items: [],
    confidence_score: 0.9,
    ...overrides,
  };
}

function extractOutcome(overrides: Record<string, unknown> = {}) {
  return {
    extraction: invoiceResult(overrides),
    metrics: {
      provider: "anthropic",
      model: "test-model",
      inputTokens: 10,
      outputTokens: 5,
      durationMs: 1,
    },
  };
}

function mockSupabase() {
  const upsert = vi.fn().mockResolvedValue({ error: null });

  // Dedupe lookup chain: .from("invoices").select(...).eq(...).eq(...).maybeSingle()
  // Defaults to "no existing row" so tests that don't care about dedupe keep
  // exercising the normal extract-and-save path.
  const maybeSingle = vi.fn().mockResolvedValue({ data: null });
  const selectEq2 = vi.fn().mockReturnValue({ maybeSingle });
  const selectEq1 = vi.fn().mockReturnValue({ eq: selectEq2 });

  // Invoice count chain (for checkStarterQuota): .from("invoices")
  //   .select("*", { count: "exact", head: true }).eq(...).gte(...)
  const gte = vi.fn().mockResolvedValue({ count: 0, error: null });
  const countEq = vi.fn().mockReturnValue({ gte });

  const select = vi.fn((_columns?: unknown, options?: { head?: boolean }) => {
    if (options?.head) return { eq: countEq };
    return { eq: selectEq1 };
  });

  // Billing subscription chain (for checkStarterQuota):
  //   .from("billing_subscriptions").select(...).eq(...).maybeSingle()
  const billingMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const billingSelectEq = vi.fn().mockReturnValue({ maybeSingle: billingMaybeSingle });
  const billingSelect = vi.fn().mockReturnValue({ eq: billingSelectEq });

  // Duplicate-counter increment chain: .from("invoices").update(...).eq("id", ...)
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn().mockReturnValue({ eq: updateEq });

  const from = vi.fn((table: string) => {
    if (table === "billing_subscriptions") return { select: billingSelect };
    return { upsert, select, update };
  });

  const upload = vi.fn().mockResolvedValue({ data: { path: "u/p.pdf" }, error: null });
  const storageFrom = vi.fn().mockReturnValue({ upload });
  return {
    client: { from, storage: { from: storageFrom } } as never,
    upsert,
    from,
    upload,
    select,
    maybeSingle,
    billingMaybeSingle,
    update,
    updateEq,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedCheckQuota.mockResolvedValue({ allowed: true });
});

describe("processExtraction", () => {
  it("returns saved:false and writes nothing when not an invoice", async () => {
    mockedExtract.mockResolvedValue(extractOutcome({ is_invoice: false }) as never);
    const sb = mockSupabase();
    const result = await processExtraction({
      supabase: sb.client,
      userId: "user-1",
      messageId: "msg-1",
      sourceRef: "body",
      input: { type: "html", html: "<p>hi</p>" },
      fileBuffer: null,
      fileName: null,
    });
    expect(result).toEqual({ saved: false });
    // checkStarterQuota queries billing_subscriptions before extraction,
    // so from() is called even when the result is "not an invoice".
    expect(mockedExtract).toHaveBeenCalled();
  });

  it("upserts on the composite conflict target and returns the summary", async () => {
    mockedExtract.mockResolvedValue(extractOutcome() as never);
    const sb = mockSupabase();
    const result = await processExtraction({
      supabase: sb.client,
      userId: "user-1",
      messageId: "msg-1",
      sourceRef: "att-1",
      input: { type: "pdf", data: Buffer.from("x") },
      fileBuffer: Buffer.from("x"),
      fileName: "bill.pdf",
    });
    expect(sb.from).toHaveBeenCalledWith("invoices");
    const [row, options] = sb.upsert.mock.calls[0]!;
    expect(options).toEqual({ onConflict: "user_id,source_message_id,source_ref" });
    expect(row).toMatchObject({
      user_id: "user-1",
      source: "email",
      source_message_id: "msg-1",
      source_ref: "att-1",
      vendor: "Acme SaaS",
    });
    expect(result).toEqual({
      saved: true,
      invoice: { vendor: "Acme SaaS", amount: 19, currency: "USD" },
    });
    expect(ensureVendorRecord).toHaveBeenCalledWith(sb.client, "user-1", "Acme SaaS");
  });

  it("flags low-confidence invoices for review", async () => {
    mockedExtract.mockResolvedValue(extractOutcome({ confidence_score: 0.4 }) as never);
    const sb = mockSupabase();
    await processExtraction({
      supabase: sb.client,
      userId: "user-1",
      messageId: "msg-1",
      sourceRef: "body",
      input: { type: "html", html: "<p>hi</p>" },
      fileBuffer: null,
      fileName: null,
    });
    expect(sb.upsert.mock.calls[0]![0]).toMatchObject({ needs_review: true });
  });

  it("stores the uploaded file path when a buffer is provided", async () => {
    mockedExtract.mockResolvedValue(extractOutcome() as never);
    const sb = mockSupabase();
    await processExtraction({
      supabase: sb.client,
      userId: "user-1",
      messageId: "msg-1",
      sourceRef: "att-1",
      input: { type: "pdf", data: Buffer.from("x") },
      fileBuffer: Buffer.from("x"),
      fileName: "bill.pdf",
    });
    expect(sb.upload).toHaveBeenCalled();
    expect(sb.upsert.mock.calls[0]![0]).toMatchObject({ file_url: "u/p.pdf" });
  });

  it("sanitizes a path-traversal filename before building the storage path", async () => {
    mockedExtract.mockResolvedValue(extractOutcome() as never);
    const sb = mockSupabase();
    await processExtraction({
      supabase: sb.client,
      userId: "user-1",
      messageId: "msg-1",
      sourceRef: "att-1",
      input: { type: "pdf", data: Buffer.from("x") },
      fileBuffer: Buffer.from("x"),
      fileName: "../../../victim-user/evil.pdf",
    });
    const [storagePath] = sb.upload.mock.calls[0]!;
    expect(storagePath).toBe("user-1/msg-1-evil.pdf");
  });

  it("leaves file_url null when there is no file buffer", async () => {
    mockedExtract.mockResolvedValue(extractOutcome() as never);
    const sb = mockSupabase();
    await processExtraction({
      supabase: sb.client,
      userId: "user-1",
      messageId: "msg-1",
      sourceRef: "body",
      input: { type: "html", html: "<p>hi</p>" },
      fileBuffer: null,
      fileName: null,
    });
    expect(sb.upload).not.toHaveBeenCalled();
    expect(sb.upsert.mock.calls[0]![0]).toMatchObject({ file_url: null });
  });

  it("reuses the existing invoice and skips extraction on a content-hash hit", async () => {
    const sb = mockSupabase();
    sb.maybeSingle.mockResolvedValueOnce({
      data: {
        id: "inv-1",
        vendor: "Acme SaaS",
        amount: 19,
        currency: "USD",
        source_message_id: "msg-OLD",
        source_ref: "att-OLD",
        duplicate_hit_count: 2,
      },
    });
    const result = await processExtraction({
      supabase: sb.client,
      userId: "user-1",
      messageId: "msg-NEW",
      sourceRef: "att-NEW",
      input: { type: "pdf", data: Buffer.from("x") },
      fileBuffer: Buffer.from("x"),
      fileName: "bill.pdf",
    });
    expect(mockedExtract).not.toHaveBeenCalled();
    expect(result).toEqual({
      saved: true,
      invoice: { vendor: "Acme SaaS", amount: 19, currency: "USD" },
    });
  });

  it("increments the duplicate counter when the hash hit is a genuinely new arrival", async () => {
    const sb = mockSupabase();
    sb.maybeSingle.mockResolvedValueOnce({
      data: {
        id: "inv-1",
        vendor: "Acme SaaS",
        amount: 19,
        currency: "USD",
        source_message_id: "msg-OLD",
        source_ref: "att-OLD",
        duplicate_hit_count: 2,
      },
    });
    await processExtraction({
      supabase: sb.client,
      userId: "user-1",
      messageId: "msg-NEW",
      sourceRef: "att-NEW",
      input: { type: "pdf", data: Buffer.from("x") },
      fileBuffer: Buffer.from("x"),
      fileName: "bill.pdf",
    });
    expect(sb.update).toHaveBeenCalledWith({ duplicate_hit_count: 3 });
    expect(sb.updateEq).toHaveBeenCalledWith("id", "inv-1");
  });

  it("does not increment the duplicate counter when the hit is the task's own retry", async () => {
    const sb = mockSupabase();
    sb.maybeSingle.mockResolvedValueOnce({
      data: {
        id: "inv-1",
        vendor: "Acme SaaS",
        amount: 19,
        currency: "USD",
        source_message_id: "msg-1",
        source_ref: "att-1",
        duplicate_hit_count: 0,
      },
    });
    const result = await processExtraction({
      supabase: sb.client,
      userId: "user-1",
      messageId: "msg-1",
      sourceRef: "att-1",
      input: { type: "pdf", data: Buffer.from("x") },
      fileBuffer: Buffer.from("x"),
      fileName: "bill.pdf",
    });
    expect(mockedExtract).not.toHaveBeenCalled();
    expect(sb.update).not.toHaveBeenCalled();
    expect(result).toEqual({
      saved: true,
      invoice: { vendor: "Acme SaaS", amount: 19, currency: "USD" },
    });
  });

  it("throws when the upsert fails for a reason other than a duplicate-hash race", async () => {
    mockedExtract.mockResolvedValue(extractOutcome() as never);
    const sb = mockSupabase();
    sb.upsert.mockResolvedValue({
      error: { code: "42P01", message: "relation does not exist" },
    });
    await expect(
      processExtraction({
        supabase: sb.client,
        userId: "user-1",
        messageId: "msg-1",
        sourceRef: "att-1",
        input: { type: "pdf", data: Buffer.from("x") },
        fileBuffer: Buffer.from("x"),
        fileName: "bill.pdf",
      }),
    ).rejects.toThrow("Could not save the extracted invoice");
  });

  it("recovers from a concurrent duplicate-hash race by returning the winning row", async () => {
    mockedExtract.mockResolvedValue(extractOutcome() as never);
    const sb = mockSupabase();
    sb.upsert.mockResolvedValue({ error: { code: "23505", message: "duplicate key" } });
    sb.maybeSingle
      .mockResolvedValueOnce({ data: null }) // pre-extraction dedupe lookup: no hit yet
      .mockResolvedValueOnce({ data: { vendor: "Acme SaaS", amount: 19, currency: "USD" } });
    const result = await processExtraction({
      supabase: sb.client,
      userId: "user-1",
      messageId: "msg-1",
      sourceRef: "att-1",
      input: { type: "pdf", data: Buffer.from("x") },
      fileBuffer: Buffer.from("x"),
      fileName: "bill.pdf",
    });
    expect(result).toEqual({
      saved: true,
      invoice: { vendor: "Acme SaaS", amount: 19, currency: "USD" },
    });
  });

  it("returns saved:false with quota details when the Starter limit is reached", async () => {
    const resetDate = new Date("2026-08-31T23:59:59.999Z").toISOString();
    mockedCheckQuota.mockResolvedValue({
      allowed: false,
      used: 50,
      limit: 50,
      resetsAt: resetDate,
    });
    const sb = mockSupabase();
    const result = await processExtraction({
      supabase: sb.client,
      userId: "user-1",
      messageId: "msg-1",
      sourceRef: "body",
      input: { type: "html", html: "<p>hi</p>" },
      fileBuffer: null,
      fileName: null,
    });
    expect(result).toEqual({
      saved: false,
      quota: { used: 50, limit: 50, resetsAt: resetDate },
    });
    // Must not call extraction when quota is exceeded — saves LLM cost.
    expect(mockedExtract).not.toHaveBeenCalled();
  });
});
