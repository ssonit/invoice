import type { createServiceClient } from "@/lib/supabase/service";
import { extractInvoice, type ExtractionInput } from "@/lib/extraction";
import { ensureVendorRecord } from "@/lib/vendors";
import { sanitizeFilename } from "@/lib/validation/common";

type ServiceClient = ReturnType<typeof createServiceClient>;

export type SavedInvoiceSummary = {
  vendor: string | null;
  amount: number | null;
  currency: string | null;
};

export type ProcessExtractionResult =
  | { saved: true; invoice: SavedInvoiceSummary }
  | { saved: false };

/**
 * Run the multi-provider extractor on one input and, if it's an invoice,
 * upsert it. Idempotent on (user_id, source_message_id, source_ref) so a task
 * retry re-processing the same attachment can't create a duplicate row.
 */
export async function processExtraction(params: {
  supabase: ServiceClient;
  userId: string;
  messageId: string;
  sourceRef: string;
  input: ExtractionInput;
  fileBuffer: Buffer | null;
  fileName: string | null;
}): Promise<ProcessExtractionResult> {
  const { supabase, userId, messageId, sourceRef, input, fileBuffer, fileName } = params;

  const { extraction: extracted } = await extractInvoice(input);
  if (!extracted.is_invoice) return { saved: false };

  // invoice-files is a private bucket — store the object path only.
  // sanitizeFilename() strips any directory components from the
  // attacker-controlled email attachment filename before it reaches the
  // storage path — otherwise a "../../other-user/x.pdf" filename would let
  // an unauthenticated sender overwrite another user's stored file.
  let fileUrl: string | null = null;
  if (fileBuffer && fileName) {
    const path = `${userId}/${messageId}-${sanitizeFilename(fileName)}`;
    const { data: uploaded } = await supabase.storage
      .from("invoice-files")
      .upload(path, fileBuffer, { upsert: true });
    if (uploaded) fileUrl = uploaded.path;
  }

  await supabase.from("invoices").upsert(
    {
      user_id: userId,
      source: "email",
      vendor: extracted.vendor,
      invoice_number: extracted.invoice_number,
      amount: extracted.amount,
      currency: extracted.currency,
      issue_date: extracted.issue_date,
      due_date: extracted.due_date,
      tax: extracted.tax,
      line_items: extracted.line_items,
      confidence_score: extracted.confidence_score,
      needs_review: extracted.confidence_score < 0.7,
      raw_extracted_json: extracted,
      file_url: fileUrl,
      source_message_id: messageId,
      source_ref: sourceRef,
    },
    { onConflict: "user_id,source_message_id,source_ref" },
  );

  await ensureVendorRecord(supabase, userId, extracted.vendor);
  return {
    saved: true,
    invoice: {
      vendor: extracted.vendor,
      amount: extracted.amount,
      currency: extracted.currency,
    },
  };
}
