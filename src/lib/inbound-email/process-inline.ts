import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import {
  shouldExtractAttachment,
  shouldExtractEmailBody,
} from "@/lib/extraction/document-gate";
import {
  processExtraction,
  type SavedInvoiceSummary,
} from "@/lib/invoices/process-extraction";
import { buildFailureOutcome } from "@/lib/invoices/build-failure-outcome";
import type { EmailReplyOutcome } from "@/lib/email-reply-templates";
import { downloadAndExtractAttachment } from "./download-and-extract-attachment";
import { sendInboundEmailReplyNow } from "./send-reply";
import {
  EXTRACTION_CONCURRENCY_LIMIT,
  type InboundAttachment,
  type ProcessInboundEmailPayload,
} from "./types";

const ATTACHMENT_ATTEMPTS = 2;

async function extractWithRetry(
  payload: ProcessInboundEmailPayload,
  userId: string,
  attachment: InboundAttachment,
) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= ATTACHMENT_ATTEMPTS; attempt++) {
    try {
      return await downloadAndExtractAttachment({
        inboxId: payload.inboxId,
        messageId: payload.messageId,
        userId,
        sender: payload.sender,
        attachment,
      });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function reply(payload: ProcessInboundEmailPayload, outcome: EmailReplyOutcome) {
  try {
    await sendInboundEmailReplyNow({
      inboxId: payload.inboxId,
      messageId: payload.messageId,
      outcome,
    });
  } catch (error) {
    console.error("Failed to send inbound email reply", payload.inboxId, payload.messageId, error);
  }
}

async function run(payload: ProcessInboundEmailPayload) {
  const supabase = createServiceClient();

  const { data: inbox, error: inboxError } = await supabase
    .from("inboxes")
    .select("user_id")
    .eq("agentmail_inbox_id", payload.inboxId)
    .is("deleted_at", null)
    .maybeSingle();
  if (inboxError) {
    throw new Error(`Failed to look up inbox ${payload.inboxId}: ${inboxError.message}`);
  }
  if (!inbox) {
    console.error("Inbound email for unknown inbox", {
      inboxId: payload.inboxId,
      messageId: payload.messageId,
      subject: payload.subject,
    });
    return;
  }

  const emailContext = { subject: payload.subject, text: payload.text, html: payload.html };
  const saved: SavedInvoiceSummary[] = [];
  let anyAttachmentFailed = false;

  if (payload.attachments.length === 0) {
    if (shouldExtractEmailBody(emailContext)) {
      const result = await processExtraction({
        supabase,
        userId: inbox.user_id,
        messageId: payload.messageId,
        sender: payload.sender,
        sourceRef: "body",
        input: { type: "html", html: payload.html ?? payload.text ?? "" },
        fileBuffer: null,
        fileName: null,
      });
      if (result.saved) saved.push(result.invoice);
    }
  } else {
    const toProcess = payload.attachments.filter((attachment) =>
      shouldExtractAttachment(
        {
          filename: attachment.filename,
          mimeType: attachment.contentType ?? "application/octet-stream",
          sizeBytes: attachment.size,
        },
        emailContext,
      ),
    );

    for (let i = 0; i < toProcess.length; i += EXTRACTION_CONCURRENCY_LIMIT) {
      const chunk = toProcess.slice(i, i + EXTRACTION_CONCURRENCY_LIMIT);
      const results = await Promise.allSettled(
        chunk.map((attachment) => extractWithRetry(payload, inbox.user_id, attachment)),
      );
      results.forEach((result, index) => {
        if (result.status === "rejected") {
          console.error(
            "Attachment processing failed",
            payload.inboxId,
            payload.messageId,
            chunk[index]!.attachmentId,
            result.reason,
          );
          anyAttachmentFailed = true;
        } else if (result.value.saved) {
          saved.push(result.value.invoice);
        }
      });
    }
  }

  const outcome: EmailReplyOutcome =
    saved.length > 0
      ? { type: "processed", invoices: saved }
      : anyAttachmentFailed
        ? { type: "error" }
        : { type: "skipped" };
  await reply(payload, outcome);
}

/**
 * Handles a forwarded email inside the webhook request itself — the path used
 * when Trigger.dev is not configured. No queue, so no automatic retry: a failure
 * is logged and the sender gets an error reply (reporting whatever did save).
 */
export async function processInboundEmailInline(payload: ProcessInboundEmailPayload) {
  try {
    await run(payload);
  } catch (error) {
    console.error("Failed to process inbound email inline", payload.inboxId, payload.messageId, error);
    const { data: rows } = await createServiceClient()
      .from("invoices")
      .select("vendor, amount, currency")
      .eq("source_message_id", payload.messageId);
    await reply(payload, buildFailureOutcome(rows ?? []));
  }
}
