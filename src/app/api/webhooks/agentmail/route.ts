import { NextResponse, type NextRequest } from "next/server";
import { Webhook } from "svix";
import { tasks } from "@trigger.dev/sdk";
import type { AgentMail } from "agentmail";
import type { processInboundEmail } from "@/trigger/process-inbound-email";

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
