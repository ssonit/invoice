import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { extractInvoice } from "@/lib/extraction";
import { ensureVendorRecord } from "@/lib/vendors";
import { validateUploadFile } from "@/lib/validation/upload";
import { sha256Hex } from "@/lib/file-hash";
import { checkUploadRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rateLimitResult = await checkUploadRateLimit(user.id);
  if (rateLimitResult.limited) {
    return NextResponse.json(
      { error: "Too many uploads — please wait a moment and try again." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimitResult.retryAfterSeconds) },
      },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing file" }, { status: 400 });
  }

  const mimeType = file.type || "application/octet-stream";
  const validated = validateUploadFile({ type: mimeType, size: file.size });
  if (!validated.success) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const contentHash = sha256Hex(buffer);

  const service = createServiceClient();

  // Exact re-upload of a file already processed for this user — return the
  // existing invoice without spending an LLM call.
  const { data: existing } = await service
    .from("invoices")
    .select()
    .eq("user_id", user.id)
    .eq("content_hash", contentHash)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ invoice: existing, duplicate: true });
  }

  const input =
    mimeType === "application/pdf"
      ? ({ type: "pdf", data: buffer } as const)
      : ({ type: "image", data: buffer, mimeType } as const);

  const extracted = await extractInvoice(input);
  if (!extracted.is_invoice) {
    return NextResponse.json(
      {
        error:
          "This file does not look like an invoice or receipt. Upload a bill, invoice, or receipt PDF/image.",
      },
      { status: 422 },
    );
  }

  const path = `${user.id}/upload-${Date.now()}-${file.name}`;
  const { data: uploaded } = await service.storage
    .from("invoice-files")
    .upload(path, buffer, { upsert: true, contentType: mimeType });

  const { data: invoice, error } = await service
    .from("invoices")
    .upsert(
      {
        user_id: user.id,
        source: "upload",
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
        file_url: uploaded?.path ?? null,
        content_hash: contentHash,
      },
      { onConflict: "user_id,content_hash" },
    )
    .select()
    .single();

  if (error) {
    console.error("Failed to save uploaded invoice", user.id, error);
    return NextResponse.json(
      { error: "Could not save the invoice. Please try again." },
      { status: 500 },
    );
  }

  await ensureVendorRecord(service, user.id, extracted.vendor);

  return NextResponse.json({ invoice });
}
