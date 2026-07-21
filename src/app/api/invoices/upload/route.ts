import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { extractInvoice } from "@/lib/extraction";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing file" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "application/octet-stream";

  const input =
    mimeType === "application/pdf"
      ? ({ type: "pdf", data: buffer } as const)
      : mimeType.startsWith("image/")
        ? ({ type: "image", data: buffer, mimeType } as const)
        : null;

  if (!input) {
    return NextResponse.json(
      { error: "unsupported file type — upload a PDF or image" },
      { status: 400 },
    );
  }

  const extracted = await extractInvoice(input);
  if (!extracted.is_invoice) {
    return NextResponse.json(
      { error: "this file does not look like an invoice" },
      { status: 422 },
    );
  }

  const service = createServiceClient();
  const path = `${user.id}/upload-${Date.now()}-${file.name}`;
  const { data: uploaded } = await service.storage
    .from("invoice-files")
    .upload(path, buffer, { upsert: true, contentType: mimeType });

  const { data: invoice, error } = await service
    .from("invoices")
    .insert({
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
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ invoice });
}
