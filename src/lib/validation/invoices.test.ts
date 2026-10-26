import { describe, expect, it } from "vitest";
import {
  parseRetryExtractionInput,
  parseSetInvoiceReviewInput,
  parseUpdateInvoiceInput,
} from "./invoices";

const ID = "3c4f0757-64f7-49b5-ad40-7f18b91dcfd5";
const BLANK = {
  vendor: "",
  invoice_number: "",
  amount: "",
  currency: "",
  issue_date: "",
  due_date: "",
  tax: "",
};

describe("parseUpdateInvoiceInput", () => {
  it("trims, uppercases currency, and parses numeric strings", () => {
    const result = parseUpdateInvoiceInput({
      id: ID,
      vendor: "  Acme Cloud  ",
      invoice_number: " INV-1 ",
      amount: "1,234.50",
      currency: " usd ",
      issue_date: "2026-08-05",
      due_date: "",
      tax: "10",
    });
    expect(result).toEqual({
      success: true,
      data: {
        id: ID,
        vendor: "Acme Cloud",
        invoice_number: "INV-1",
        amount: 1234.5,
        currency: "USD",
        issue_date: "2026-08-05",
        due_date: null,
        tax: 10,
      },
    });
  });

  it("turns blank fields into null", () => {
    const result = parseUpdateInvoiceInput({
      id: ID,
      vendor: "",
      invoice_number: "  ",
      amount: "",
      currency: "",
      issue_date: "",
      due_date: "",
      tax: "",
    });
    expect(result.success && result.data.amount).toBeNull();
    expect(result.success && result.data.currency).toBeNull();
    expect(result.success && result.data.vendor).toBeNull();
  });

  it("rejects an invalid id", () => {
    expect(parseUpdateInvoiceInput({ ...BLANK, id: "nope" }).success).toBe(false);
  });

  it("rejects impossible dates", () => {
    const result = parseUpdateInvoiceInput({ ...BLANK, id: ID, issue_date: "2026-02-31" });
    expect(result).toEqual({
      success: false,
      error: "Invoice date must be a valid date (YYYY-MM-DD)",
    });
  });

  it("rejects non-numeric amounts", () => {
    const result = parseUpdateInvoiceInput({ ...BLANK, id: ID, amount: "abc" });
    expect(result.success).toBe(false);
  });

  it("rejects malformed currency codes", () => {
    expect(parseUpdateInvoiceInput({ ...BLANK, id: ID, currency: "US" }).success).toBe(false);
    expect(parseUpdateInvoiceInput({ ...BLANK, id: ID, currency: "US1" }).success).toBe(false);
  });

  it("rejects an over-long vendor", () => {
    expect(
      parseUpdateInvoiceInput({ ...BLANK, id: ID, vendor: "x".repeat(201) }).success,
    ).toBe(false);
  });
});

describe("parseSetInvoiceReviewInput", () => {
  it("accepts approved and review", () => {
    expect(parseSetInvoiceReviewInput({ id: ID, status: "approved" }).success).toBe(true);
    expect(parseSetInvoiceReviewInput({ id: ID, status: "review" }).success).toBe(true);
  });

  it("rejects other statuses", () => {
    expect(parseSetInvoiceReviewInput({ id: ID, status: "done" }).success).toBe(false);
  });
});

describe("parseRetryExtractionInput", () => {
  it("requires a uuid", () => {
    expect(parseRetryExtractionInput({ id: ID }).success).toBe(true);
    expect(parseRetryExtractionInput({ id: "1" }).success).toBe(false);
  });
});
