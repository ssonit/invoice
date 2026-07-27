import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/extraction", () => ({ extractInvoice: vi.fn() }));
vi.mock("@/lib/vendors", () => ({ ensureVendorRecord: vi.fn() }));

import { extractInvoice } from "@/lib/extraction";
import { ensureVendorRecord } from "@/lib/vendors";
import { processExtraction } from "./process-extraction";

const mockedExtract = vi.mocked(extractInvoice);

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

function mockSupabase() {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn().mockReturnValue({ upsert });
  const upload = vi.fn().mockResolvedValue({ data: { path: "u/p.pdf" }, error: null });
  const storageFrom = vi.fn().mockReturnValue({ upload });
  return {
    client: { from, storage: { from: storageFrom } } as never,
    upsert,
    from,
    upload,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("processExtraction", () => {
  it("returns saved:false and writes nothing when not an invoice", async () => {
    mockedExtract.mockResolvedValue(invoiceResult({ is_invoice: false }) as never);
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
    expect(sb.from).not.toHaveBeenCalled();
  });

  it("upserts on the composite conflict target and returns the summary", async () => {
    mockedExtract.mockResolvedValue(invoiceResult() as never);
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
    mockedExtract.mockResolvedValue(invoiceResult({ confidence_score: 0.4 }) as never);
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
    mockedExtract.mockResolvedValue(invoiceResult() as never);
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
    mockedExtract.mockResolvedValue(invoiceResult() as never);
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
    mockedExtract.mockResolvedValue(invoiceResult() as never);
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
});
