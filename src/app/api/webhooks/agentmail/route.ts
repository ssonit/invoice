import { after, NextResponse, type NextRequest } from "next/server";
import { Webhook } from "svix";
import { tasks } from "@trigger.dev/sdk";
import type { processInboundEmail } from "@/trigger/process-inbound-email";
import { checkContentLength } from "@/lib/validation/common";
import { MAX_WEBHOOK_BODY_BYTES } from "@/constants/validation";
import { isEmailIntakeConfigured, isTriggerConfigured } from "@/lib/email-intake";
import { processInboundEmailInline } from "@/lib/inbound-email/process-inline";
import { parseWebhookMessage } from "@/lib/inbound-email/parse-webhook-message";

// Inline (no Trigger.dev) processing runs in after(); give it room for several attachments.
export const maxDuration = 300;

// Only POST is a real method here; answer anything else like a missing route
// instead of Next's default 405 so a disabled intake looks fully absent.
export function GET() {
  return NextResponse.json({ error: "not found" }, { status: 404 });
}

export async function POST(request: NextRequest) {
  if (!isEmailIntakeConfigured(process.env)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

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

  let event: { event_type: string; message: unknown };
  try {
    event = new Webhook(webhookSecret).verify(payload, headers) as typeof event;
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (event.event_type !== "message.received") {
    return NextResponse.json({ status: "ignored" });
  }

  const emailPayload = parseWebhookMessage(event.message);
  if (!emailPayload) {
    console.error("AgentMail webhook message is missing inbox_id or message_id", event.message);
    return NextResponse.json({ error: "invalid message" }, { status: 400 });
  }

  // No Trigger.dev: answer 200 now and do the work after the response, within
  // this route's maxDuration. No queue, so no automatic retry.
  if (!isTriggerConfigured(process.env)) {
    after(() => processInboundEmailInline(emailPayload));
    return NextResponse.json({ status: "processing" });
  }

  // Hand off to the background queue and return immediately. idempotencyKey =
  // messageId means an AgentMail webhook retry returns the original run instead
  // of starting a duplicate — no processed_messages table needed.
  try {
    await tasks.trigger<typeof processInboundEmail>("process-inbound-email", emailPayload, {
      idempotencyKey: emailPayload.messageId,
    });
  } catch (error) {
    // Non-2xx makes AgentMail retry the delivery. Typical causes: wrong
    // TRIGGER_SECRET_KEY environment, or tasks not deployed to that environment.
    console.error(
      "Failed to queue inbound email task",
      emailPayload.inboxId,
      emailPayload.messageId,
      error,
    );
    return NextResponse.json({ status: "error" }, { status: 500 });
  }

  return NextResponse.json({ status: "queued" });
}
