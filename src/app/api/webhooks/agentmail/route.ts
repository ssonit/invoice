import { NextResponse, type NextRequest } from "next/server";
import { Webhook } from "svix";
import { agentmail } from "@/lib/agentmail";
import { createServiceClient } from "@/lib/supabase/service";
import { extractInvoice } from "@/lib/extraction";
import type { AgentMail } from "agentmail";

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const headers = Object.fromEntries(request.headers);

  let event: { event_type: string; message: AgentMail.Message };
  try {
    event = new Webhook(process.env.AGENTMAIL_WEBHOOK_SECRET!).verify(
      payload,
      headers,
    ) as typeof event;
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (event.event_type !== "message.received") {
    return NextResponse.json({ status: "ignored" });
  }

  const message = event.message;
  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from("processed_messages")
    .select("message_id")
    .eq("message_id", message.messageId)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ status: "already_processed" });
  }

  const { data: inbox } = await supabase
    .from("inboxes")
    .select("user_id")
    .eq("agentmail_inbox_id", message.inboxId)
    .maybeSingle();

  if (!inbox) {
    console.error("Webhook for unknown inbox", message.inboxId);
    return NextResponse.json({ status: "unknown_inbox" });
  }

  const attachments = message.attachments ?? [];

  if (attachments.length === 0) {
    const html = message.html ?? message.text ?? "";
    await processExtraction({
      supabase,
      userId: inbox.user_id,
      messageId: message.messageId,
      input: { type: "html", html },
      fileBuffer: null,
      fileName: null,
    });
  } else {
    for (const attachment of attachments) {
      const { downloadUrl } = await agentmail.inboxes.messages.getAttachment(
        message.inboxId,
        message.messageId,
        attachment.attachmentId,
      );
      const fileRes = await fetch(downloadUrl);
      const fileBuffer = Buffer.from(await fileRes.arrayBuffer());
      const mimeType = attachment.contentType ?? "application/octet-stream";

      const input =
        mimeType === "application/pdf"
          ? ({ type: "pdf", data: fileBuffer } as const)
          : mimeType.startsWith("image/")
            ? ({ type: "image", data: fileBuffer, mimeType } as const)
            : null;

      if (!input) continue; // unsupported attachment type, skip

      await processExtraction({
        supabase,
        userId: inbox.user_id,
        messageId: message.messageId,
        input,
        fileBuffer,
        fileName: attachment.filename ?? attachment.attachmentId,
      });
    }
  }

  await supabase
    .from("processed_messages")
    .insert({ message_id: message.messageId, inbox_id: message.inboxId });

  return NextResponse.json({ status: "processed" });
}

async function processExtraction(params: {
  supabase: ReturnType<typeof createServiceClient>;
  userId: string;
  messageId: string;
  input: Parameters<typeof extractInvoice>[0];
  fileBuffer: Buffer | null;
  fileName: string | null;
}) {
  const { supabase, userId, messageId, input, fileBuffer, fileName } = params;

  const extracted = await extractInvoice(input);
  if (!extracted.is_invoice) return;

  // invoice-files is a private bucket — store the object path here and
  // generate a signed URL on read (see src/lib/storage.ts).
  let fileUrl: string | null = null;
  if (fileBuffer && fileName) {
    const path = `${userId}/${messageId}-${fileName}`;
    const { data: uploaded } = await supabase.storage
      .from("invoice-files")
      .upload(path, fileBuffer, { upsert: true });
    if (uploaded) {
      fileUrl = uploaded.path;
    }
  }

  await supabase.from("invoices").insert({
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
  });
}
