import { task, tasks } from "@trigger.dev/sdk";
import { agentmail } from "@/lib/agentmail";
import { createServiceClient } from "@/lib/supabase/service";
import {
  shouldExtractAttachment,
  shouldExtractEmailBody,
} from "@/lib/extraction/document-gate";
import {
  processExtraction,
  type SavedInvoiceSummary,
} from "@/lib/invoices/process-extraction";
import type { EmailReplyOutcome } from "@/lib/email-reply-templates";
import type { sendInboundEmailReply } from "./send-inbound-email-reply";

export type ProcessInboundEmailPayload = {
  inboxId: string;
  messageId: string;
  subject: string | null;
  text: string | null;
  html: string | null;
  attachments: {
    attachmentId: string;
    filename: string | null;
    contentType: string | null;
    size: number | null;
  }[];
};

// Cap simultaneous extractions (LLM calls + Supabase writes) regardless of how
// many webhook events arrive at once. Excess runs queue, nothing is dropped.
export const EXTRACTION_CONCURRENCY_LIMIT = 5;

// SavedInvoiceSummary is structurally identical to the reply builder's
// ReplyInvoiceSummary, so a saved-invoices array satisfies EmailReplyOutcome.
function triggerReply(
  inboxId: string,
  messageId: string,
  outcome: EmailReplyOutcome,
  idempotencyKey: string,
) {
  return tasks.trigger<typeof sendInboundEmailReply>(
    "send-inbound-email-reply",
    { inboxId, messageId, outcome },
    { idempotencyKey },
  );
}

export const processInboundEmail = task({
  id: "process-inbound-email",
  queue: { concurrencyLimit: EXTRACTION_CONCURRENCY_LIMIT },
  retry: { maxAttempts: 3 },
  onFailure: async ({ payload }: { payload: ProcessInboundEmailPayload }) => {
    // Fires once, only after all retry attempts are exhausted.
    await triggerReply(
      payload.inboxId,
      payload.messageId,
      { type: "error" },
      `reply:error:${payload.messageId}`,
    );
  },
  run: async (payload: ProcessInboundEmailPayload) => {
    const supabase = createServiceClient();

    const { data: inbox } = await supabase
      .from("inboxes")
      .select("user_id")
      .eq("agentmail_inbox_id", payload.inboxId)
      .maybeSingle();

    if (!inbox) {
      // Internal mapping problem, not the sender's fault — log and stop, no reply.
      console.error("Inbound-email task for unknown inbox", payload.inboxId);
      return { status: "unknown_inbox" as const };
    }

    const emailContext = {
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    };
    const saved: SavedInvoiceSummary[] = [];

    if (payload.attachments.length === 0) {
      if (shouldExtractEmailBody(emailContext)) {
        const html = payload.html ?? payload.text ?? "";
        const result = await processExtraction({
          supabase,
          userId: inbox.user_id,
          messageId: payload.messageId,
          sourceRef: "body",
          input: { type: "html", html },
          fileBuffer: null,
          fileName: null,
        });
        if (result.saved) saved.push(result.invoice);
      }
    } else {
      for (const attachment of payload.attachments) {
        const mimeType = attachment.contentType ?? "application/octet-stream";
        if (
          !shouldExtractAttachment(
            {
              filename: attachment.filename,
              mimeType,
              sizeBytes: attachment.size,
            },
            emailContext,
          )
        ) {
          continue;
        }

        const { downloadUrl } = await agentmail.inboxes.messages.getAttachment(
          payload.inboxId,
          payload.messageId,
          attachment.attachmentId,
        );
        const fileRes = await fetch(downloadUrl);
        const fileBuffer = Buffer.from(await fileRes.arrayBuffer());

        const input =
          mimeType === "application/pdf"
            ? ({ type: "pdf", data: fileBuffer } as const)
            : mimeType.startsWith("image/")
              ? ({ type: "image", data: fileBuffer, mimeType } as const)
              : null;
        if (!input) continue;

        const result = await processExtraction({
          supabase,
          userId: inbox.user_id,
          messageId: payload.messageId,
          sourceRef: attachment.attachmentId,
          input,
          fileBuffer,
          fileName: attachment.filename ?? attachment.attachmentId,
        });
        if (result.saved) saved.push(result.invoice);
      }
    }

    await triggerReply(
      payload.inboxId,
      payload.messageId,
      saved.length > 0 ? { type: "processed", invoices: saved } : { type: "skipped" },
      `reply:${payload.messageId}`,
    );

    return {
      status: saved.length > 0 ? ("processed" as const) : ("skipped_non_invoice" as const),
      extracted: saved.length,
    };
  },
});
