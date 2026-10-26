"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { extractInvoice } from "@/lib/extraction";
import { isUnreadableDocumentError } from "@/lib/extraction/provider-errors";
import { ensureVendorRecord } from "@/lib/vendors";
import { mimeTypeFromPath } from "@/lib/invoices/file-type";
import { EXTRACTION_CONFIDENCE_REVIEW_THRESHOLD } from "@/constants/extraction";
import {
  INVOICE_REVIEW_STATUS,
  parseRetryExtractionInput,
  parseSetInvoiceReviewInput,
  parseUpdateInvoiceInput,
} from "@/lib/validation/invoices";

export type InvoiceMutationResult = { ok: true } | { ok: false; error: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
}

function revalidateInvoiceViews() {
  for (const path of [
    "/dashboard",
    "/dashboard/inbox",
    "/dashboard/invoices",
    "/dashboard/analytics",
    "/dashboard/vendors",
  ]) {
    revalidatePath(path);
  }
}

// Saves the user's corrections to one invoice's extracted fields.
export async function updateInvoice(input: unknown): Promise<InvoiceMutationResult> {
  const parsed = parseUpdateInvoiceInput(input);
  if (!parsed.success) return { ok: false, error: parsed.error };

  const user = await requireUser();
  const service = createServiceClient();
  const { id, ...fields } = parsed.data;

  const { data, error } = await service
    .from("invoices")
    .update(fields)
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    // 23505 = same vendor + invoice number as another saved invoice.
    if (error.code === "23505") {
      return {
        ok: false,
        error: "Another invoice already has this vendor and invoice number.",
      };
    }
    console.error("Failed to update invoice", user.id, id, error);
    return { ok: false, error: "Could not save changes. Please try again." };
  }
  if (!data) return { ok: false, error: "Invoice not found." };

  await ensureVendorRecord(service, user.id, fields.vendor);
  revalidateInvoiceViews();
  return { ok: true };
}

// "Mark approved" / "Request review" from the inbox Actions menu.
export async function setInvoiceReviewStatus(input: unknown): Promise<InvoiceMutationResult> {
  const parsed = parseSetInvoiceReviewInput(input);
  if (!parsed.success) return { ok: false, error: parsed.error };

  const user = await requireUser();
  const service = createServiceClient();
  const isApproval = parsed.data.status === INVOICE_REVIEW_STATUS.APPROVED;

  const { data, error } = await service
    .from("invoices")
    .update({
      needs_review: !isApproval,
      approved_at: isApproval ? new Date().toISOString() : null,
    })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Failed to set invoice review status", user.id, parsed.data.id, error);
    return { ok: false, error: "Could not update the invoice. Please try again." };
  }
  if (!data) return { ok: false, error: "Invoice not found." };

  revalidateInvoiceViews();
  return { ok: true };
}

// Re-runs extraction on the stored file and overwrites the extracted fields.
export async function retryInvoiceExtraction(input: unknown): Promise<InvoiceMutationResult> {
  const parsed = parseRetryExtractionInput(input);
  if (!parsed.success) return { ok: false, error: parsed.error };

  const user = await requireUser();
  const service = createServiceClient();

  const { data: invoice, error: loadError } = await service
    .from("invoices")
    .select("id, file_url")
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (loadError || !invoice) return { ok: false, error: "Invoice not found." };

  const mimeType = invoice.file_url ? mimeTypeFromPath(invoice.file_url) : null;
  if (!invoice.file_url || !mimeType) {
    return {
      ok: false,
      error: "There is no stored PDF or image to re-read for this invoice.",
    };
  }

  const { data: blob, error: downloadError } = await service.storage
    .from("invoice-files")
    .download(invoice.file_url);
  if (downloadError || !blob) {
    console.error("Failed to download invoice file for retry", user.id, invoice.id, downloadError);
    return { ok: false, error: "Could not read the stored file. Please try again." };
  }

  const buffer = Buffer.from(await blob.arrayBuffer());
  const extractionInput =
    mimeType === "application/pdf"
      ? ({ type: "pdf", data: buffer } as const)
      : ({ type: "image", data: buffer, mimeType } as const);

  let result: Awaited<ReturnType<typeof extractInvoice>>;
  try {
    result = await extractInvoice(extractionInput);
  } catch (err) {
    console.error("Failed to retry invoice extraction", user.id, invoice.id, err);
    if (isUnreadableDocumentError(err)) {
      return { ok: false, error: "The stored file could not be read." };
    }
    return { ok: false, error: "Extraction failed. Please try again." };
  }

  const { extraction, metrics } = result;
  if (!extraction.is_invoice) {
    return { ok: false, error: "The file no longer looks like an invoice." };
  }

  const { error: updateError } = await service
    .from("invoices")
    .update({
      vendor: extraction.vendor,
      invoice_number: extraction.invoice_number,
      amount: extraction.amount,
      currency: extraction.currency,
      issue_date: extraction.issue_date,
      due_date: extraction.due_date,
      tax: extraction.tax,
      line_items: extraction.line_items,
      confidence_score: extraction.confidence_score,
      needs_review: extraction.confidence_score < EXTRACTION_CONFIDENCE_REVIEW_THRESHOLD,
      approved_at: null,
      raw_extracted_json: extraction,
      extraction_provider: metrics.provider,
      extraction_model: metrics.model,
      extraction_input_tokens: metrics.inputTokens,
      extraction_output_tokens: metrics.outputTokens,
      extraction_ms: metrics.durationMs,
      extraction_method: metrics.method,
    })
    .eq("id", invoice.id)
    .eq("user_id", user.id);

  if (updateError) {
    console.error("Failed to save retried extraction", user.id, invoice.id, updateError);
    return { ok: false, error: "Could not save the new extraction. Please try again." };
  }

  await ensureVendorRecord(service, user.id, extraction.vendor);
  revalidateInvoiceViews();
  return { ok: true };
}
