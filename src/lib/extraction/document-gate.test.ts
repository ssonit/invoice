import { describe, expect, it } from "vitest";
import {
  hasInvoiceOrReceiptSignals,
  isExtractableMimeType,
  isLikelyDecorativeAttachment,
  shouldExtractAttachment,
  shouldExtractEmailBody,
  MIN_IMAGE_BYTES_FOR_EXTRACTION,
} from "./document-gate";

describe("hasInvoiceOrReceiptSignals", () => {
  it("detects English invoice/receipt terms", () => {
    expect(hasInvoiceOrReceiptSignals("Your Invoice #123")).toBe(true);
    expect(hasInvoiceOrReceiptSignals("Payment receipt attached")).toBe(true);
  });

  it("detects Vietnamese hoá đơn / biên lai", () => {
    expect(hasInvoiceOrReceiptSignals("Hóa đơn GTGT tháng 7")).toBe(true);
    expect(hasInvoiceOrReceiptSignals("Bien lai thanh toan")).toBe(true);
  });

  it("rejects unrelated mail", () => {
    expect(hasInvoiceOrReceiptSignals("Weekly newsletter digest")).toBe(false);
    expect(hasInvoiceOrReceiptSignals("Lunch tomorrow?")).toBe(false);
  });
});

describe("shouldExtractEmailBody", () => {
  it("requires invoice cues in subject or body", () => {
    expect(
      shouldExtractEmailBody({ subject: "Hello", text: "See you soon", html: null }),
    ).toBe(false);
    expect(
      shouldExtractEmailBody({ subject: "Invoice from Acme", text: "Attached", html: null }),
    ).toBe(true);
  });
});

describe("shouldExtractAttachment", () => {
  const invoiceEmail = {
    subject: "Invoice from Acme",
    text: "Please find your invoice",
    html: null,
  };
  const randomEmail = { subject: "Hi", text: "Photo from vacation", html: null };

  it("accepts PDFs even with opaque filenames", () => {
    expect(
      shouldExtractAttachment(
        { filename: "scan001.pdf", mimeType: "application/pdf", sizeBytes: 200_000 },
        randomEmail,
      ),
    ).toBe(true);
  });

  it("accepts images when email or filename looks like an invoice", () => {
    expect(
      shouldExtractAttachment(
        { filename: "photo.jpg", mimeType: "image/jpeg", sizeBytes: 200_000 },
        invoiceEmail,
      ),
    ).toBe(true);
    expect(
      shouldExtractAttachment(
        { filename: "receipt.png", mimeType: "image/png", sizeBytes: 200_000 },
        randomEmail,
      ),
    ).toBe(true);
  });

  it("rejects images without invoice cues", () => {
    expect(
      shouldExtractAttachment(
        { filename: "vacation.jpg", mimeType: "image/jpeg", sizeBytes: 200_000 },
        randomEmail,
      ),
    ).toBe(false);
  });

  it("rejects unsupported types and decorative files", () => {
    expect(
      shouldExtractAttachment(
        { filename: "notes.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", sizeBytes: 20_000 },
        invoiceEmail,
      ),
    ).toBe(false);
    expect(
      shouldExtractAttachment(
        { filename: "company-logo.png", mimeType: "image/png", sizeBytes: 200_000 },
        invoiceEmail,
      ),
    ).toBe(false);
    expect(
      isLikelyDecorativeAttachment({
        filename: "sig.png",
        mimeType: "image/png",
        sizeBytes: MIN_IMAGE_BYTES_FOR_EXTRACTION - 1,
      }),
    ).toBe(true);
  });

  it("recognizes extractable mime types", () => {
    expect(isExtractableMimeType("application/pdf")).toBe(true);
    expect(isExtractableMimeType("image/jpeg; charset=binary")).toBe(true);
    expect(isExtractableMimeType("text/plain")).toBe(false);
  });
});
