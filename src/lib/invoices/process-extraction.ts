import type { createServiceClient } from "@/lib/supabase/service";
import { extractInvoice, type ExtractionInput } from "@/lib/extraction";
import { ensureVendorRecord } from "@/lib/vendors";
import { sanitizeFilename } from "@/lib/validation/common";
import { sha256Hex } from "@/lib/file-hash";
import { checkStarterQuota } from "@/lib/billing/usage";

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
 * retry re-processing the same attachment can't create a duplicate row. Also
 * deduped on (user_id, content_hash): a byte-identical attachment seen before
 * for this user reuses the existing invoice instead of paying for another
 * extraction, while a task retry re-finding its own prior save is not counted
 * as a second arrival of the file from the user.
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

  // Same file, seen before → reuse the invoice instead of paying for another
  // extraction. Only attachments can be hashed; an HTML body has no buffer.
  const contentHash = fileBuffer ? sha256Hex(fileBuffer) : null;

  if (contentHash) {
    const { data: existing } = await supabase
      .from("invoices")
      .select("id, vendor, amount, currency, source_message_id, source_ref, duplicate_hit_count")
      .eq("user_id", userId)
      .eq("content_hash", contentHash)
      .maybeSingle();

    if (existing) {
      // A task retry re-runs this function from scratch and finds the row the
      // previous attempt saved. That is our own retry, not a second arrival
      // from the user, so it must not inflate the counter.
      const isSameSource =
        existing.source_message_id === messageId && existing.source_ref === sourceRef;

      if (!isSameSource) {
        const { error: hitError } = await supabase
          .from("invoices")
          .update({ duplicate_hit_count: (existing.duplicate_hit_count ?? 0) + 1 })
          .eq("id", existing.id);
        if (hitError) {
          console.error("Failed to record duplicate extraction hit", userId, hitError);
        }
      }

      return {
        saved: true,
        invoice: {
          vendor: existing.vendor,
          amount: existing.amount,
          currency: existing.currency,
        },
      };
    }
  }

  // Starter-plan monthly quota — skip the LLM call when the user has
  // reached their cap this month. Team and dev_unlock always pass through.
  // Checked after dedup so duplicate hits don't count toward the limit.
  const quota = await checkStarterQuota(supabase, userId);
  if (!quota.allowed) {
    console.log(
      "Starter quota exceeded — skipping extraction",
      userId,
      { used: quota.used, limit: quota.limit },
    );
    return { saved: false };
  }

  const { extraction: extracted, metrics } = await extractInvoice(input);
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

  const { error: upsertError } = await supabase.from("invoices").upsert(
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
      extraction_provider: metrics.provider,
      extraction_model: metrics.model,
      extraction_input_tokens: metrics.inputTokens,
      extraction_output_tokens: metrics.outputTokens,
      extraction_ms: metrics.durationMs,
      file_url: fileUrl,
      source_message_id: messageId,
      source_ref: sourceRef,
      content_hash: contentHash,
    },
    { onConflict: "user_id,source_message_id,source_ref" },
  );

  if (upsertError) {
    // 23505 = unique violation. A concurrent attachment with the same content
    // hash won the race; treat this one as a duplicate rather than failing.
    if (upsertError.code === "23505" && contentHash) {
      const { data: winner } = await supabase
        .from("invoices")
        .select("vendor, amount, currency")
        .eq("user_id", userId)
        .eq("content_hash", contentHash)
        .maybeSingle();
      if (winner) {
        return {
          saved: true,
          invoice: {
            vendor: winner.vendor,
            amount: winner.amount,
            currency: winner.currency,
          },
        };
      }
    }
    console.error("Failed to save extracted invoice", userId, upsertError);
    throw new Error("Could not save the extracted invoice");
  }

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
