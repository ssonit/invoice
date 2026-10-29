"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { extractInvoice } from "@/lib/extraction";
import { isUnreadableDocumentError } from "@/lib/extraction/provider-errors";
import { ensureVendorRecord } from "@/lib/vendors";
import { mimeTypeFromPath } from "@/lib/invoices/file-type";
import { checkUploadRateLimit } from "@/lib/rate-limit";
import type { InvoiceExtraction } from "@/lib/extraction/schema";
import {
  INVOICE_REVIEW_STATUS,
  parseDeleteInvoiceInput,
  parseRetryExtractionInput,
  parseSetInvoiceReviewInput,
  parseUpdateInvoiceInput,
} from "@/lib/validation/invoices";

export type InvoiceMutationResult = { ok: true } | { ok: false; error: string };
export type InvoiceExtractionPreviewResult =
  | { ok: true; extraction: InvoiceExtraction }
  | { ok: false; error: string };

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
    "/dashboard/exports",
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
    .update({ ...fields, needs_review: true, approved_at: null })
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

// Soft delete: flips deleted_at so lists, totals, analytics and vendor counts
// drop the invoice while the row and stored file stay recoverable.
export async function deleteInvoice(input: unknown): Promise<InvoiceMutationResult> {
  const parsed = parseDeleteInvoiceInput(input);
  if (!parsed.success) return { ok: false, error: parsed.error };

  const user = await requireUser();
  const service = createServiceClient();

  const { data, error } = await service
    .from("invoices")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Failed to delete invoice", user.id, parsed.data.id, error);
    return { ok: false, error: "Could not delete the invoice. Please try again." };
  }
  if (!data) return { ok: false, error: "Invoice not found." };

  revalidateInvoiceViews();
  return { ok: true };
}

// Read-only proposal. Persist changes only through updateInvoice after review.
export async function previewInvoiceExtraction(input: unknown): Promise<InvoiceExtractionPreviewResult> {
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

  const rateLimit = await checkUploadRateLimit(user.id);
  if (rateLimit.limited) {
    return { ok: false, error: `Too many extraction requests. Try again in ${rateLimit.retryAfterSeconds} seconds.` };
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

  const { extraction } = result;
  if (!extraction.is_invoice) {
    return { ok: false, error: "The file no longer looks like an invoice." };
  }

  // Preview calls incur cost even when cancelled; do not overwrite the saved
  // invoice's original extraction metrics before the user chooses to save.
  console.info("Invoice extraction preview completed", { userId: user.id, invoiceId: invoice.id, ...result.metrics });

  return { ok: true, extraction };
}
