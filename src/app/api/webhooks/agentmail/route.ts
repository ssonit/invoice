import { NextResponse, type NextRequest } from "next/server";
import { Webhook } from "svix";
import { tasks } from "@trigger.dev/sdk";
import type { AgentMail } from "agentmail";
import type { processInboundEmail } from "@/trigger/process-inbound-email";
import { checkContentLength } from "@/lib/validation/common";
import { MAX_WEBHOOK_BODY_BYTES } from "@/constants/validation";

export async function POST(request: NextRequest) {
  const contentLength = checkContentLength(request, MAX_WEBHOOK_BODY_BYTES);
  if (!contentLength.success) {
    return NextResponse.json({ error: contentLength.error }, { status: 413 });
  }

  const payload = await request.text();
  if (payload.length > MAX_WEBHOOK_BODY_BYTES) {
    return NextResponse.json({ error: "Request payload is too large" }, { status: 413 });
  }

  const headers = Object.fromEntries(request.headers);

  const webhookSecret = process.env.AGENTMAIL_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("Failed to verify AgentMail webhook: AGENTMAIL_WEBHOOK_SECRET is not set");
    return NextResponse.json({ status: "error" }, { status: 500 });
  }

  let event: { event_type: string; message: AgentMail.Message };
  try {
    event = new Webhook(webhookSecret).verify(payload, headers) as typeof event;
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (event.event_type !== "message.received") {
    return NextResponse.json({ status: "ignored" });
  }

  const message = event.message;

  // Hand off to the background queue and return immediately. idempotencyKey =
  // messageId means an AgentMail webhook retry returns the original run instead
  // of starting a duplicate — no processed_messages table needed.
  await tasks.trigger<typeof processInboundEmail>(
    "process-inbound-email",
    {
      inboxId: message.inboxId,
      messageId: message.messageId,
      subject: message.subject ?? null,
      text: message.text ?? message.extractedText ?? null,
      html: message.html ?? message.extractedHtml ?? null,
      attachments: (message.attachments ?? []).map((attachment) => ({
        attachmentId: attachment.attachmentId,
        filename: attachment.filename ?? null,
        contentType: attachment.contentType ?? null,
        size: attachment.size ?? null,
      })),
    },
    { idempotencyKey: message.messageId },
  );

  return NextResponse.json({ status: "queued" });
}
