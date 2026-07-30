import { describe, expect, it } from "vitest";
import { aggregateAttachmentResults, type AttachmentTaskRun } from "./aggregate-attachment-results";

function ok(saved: boolean, invoice?: { vendor: string | null; amount: number | null; currency: string | null }): AttachmentTaskRun {
  return saved
    ? { ok: true, output: { saved: true, invoice: invoice! } }
    : { ok: true, output: { saved: false } };
}

function failed(error: unknown = new Error("boom")): AttachmentTaskRun {
  return { ok: false, error };
}

const invoiceA = { vendor: "Acme", amount: 10, currency: "USD" };
const invoiceB = { vendor: "Globex", amount: 20, currency: "USD" };

describe("aggregateAttachmentResults", () => {
  it("collects every saved invoice when all runs succeed", () => {
    const runs = [ok(true, invoiceA), ok(true, invoiceB)];
    expect(aggregateAttachmentResults(runs)).toEqual([invoiceA, invoiceB]);
  });

  it("returns an empty array when every run failed", () => {
    const runs = [failed(), failed()];
    expect(aggregateAttachmentResults(runs)).toEqual([]);
  });

  it("keeps the saved invoices and drops the failed and non-invoice runs in a mix", () => {
    const runs = [ok(true, invoiceA), failed(), ok(false), ok(true, invoiceB)];
    expect(aggregateAttachmentResults(runs)).toEqual([invoiceA, invoiceB]);
  });

  it("ignores a run that completed but decided the attachment was not an invoice", () => {
    const runs = [ok(false)];
    expect(aggregateAttachmentResults(runs)).toEqual([]);
  });

  it("returns an empty array for an empty batch", () => {
    expect(aggregateAttachmentResults([])).toEqual([]);
  });
});
