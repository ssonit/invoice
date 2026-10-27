import { task, tasks } from "@trigger.dev/sdk";
import { createServiceClient } from "@/lib/supabase/service";
import {
  shouldExtractAttachment,
  shouldExtractEmailBody,
} from "@/lib/extraction/document-gate";
import {
  processExtraction,
  type SavedInvoiceSummary,
} from "@/lib/invoices/process-extraction";
import { aggregateAttachmentResults } from "@/lib/invoices/aggregate-attachment-results";
import { buildFailureOutcome } from "@/lib/invoices/build-failure-outcome";
import type { EmailReplyOutcome } from "@/lib/email-reply-templates";
import type { sendInboundEmailReply } from "./send-inbound-email-reply";
import type { processAttachment } from "./process-attachment";
import type {
  ProcessAttachmentPayload,
  ProcessInboundEmailPayload,
} from "@/lib/inbound-email/types";

export type { ProcessInboundEmailPayload };

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
  retry: { maxAttempts: 3 },
  onFailure: async ({ payload }: { payload: ProcessInboundEmailPayload }) => {
    // Fires once, only after all retry attempts are exhausted. An earlier
    // attempt may have already upserted some attachments before a later
    // retry kept failing — check what actually landed instead of always
    // reporting "error" to the sender.
    const supabase = createServiceClient();
    const { data: rows } = await supabase
      .from("invoices")
      .select("vendor, amount, currency")
      .eq("source_message_id", payload.messageId);
    await triggerReply(
      payload.inboxId,
      payload.messageId,
      buildFailureOutcome(rows ?? []),
      `reply:error:${payload.messageId}`,
    );
  },
  run: async (payload: ProcessInboundEmailPayload) => {
    const supabase = createServiceClient();

    // Active rows only: a deleted-then-recreated account leaves a soft-deleted
    // row with the same AgentMail inbox id, which would make maybeSingle() error.
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
      // Internal mapping problem, not the sender's fault — log and stop, no reply.
      // Most likely an orphaned AgentMail inbox: created upstream but the matching
      // `inboxes` row never got inserted (e.g. createInbox's DB write failed after
      // the AgentMail-side create succeeded). Logging inboxId + messageId + subject
      // here is what makes that case findable — this is a silent drop otherwise.
      console.error(
        "Inbound-email task for unknown inbox",
        { inboxId: payload.inboxId, messageId: payload.messageId, subject: payload.subject },
      );
      return { status: "unknown_inbox" as const };
    }

    const emailContext = {
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    };
    const saved: SavedInvoiceSummary[] = [];
    let anyAttachmentFailed = false;

    if (payload.attachments.length === 0) {
      if (shouldExtractEmailBody(emailContext)) {
        const html = payload.html ?? payload.text ?? "";
        const result = await processExtraction({
          supabase,
          userId: inbox.user_id,
          messageId: payload.messageId,
          sender: payload.sender,
          sourceRef: "body",
          input: { type: "html", html },
          fileBuffer: null,
          fileName: null,
        });
        if (result.saved) {
          saved.push(result.invoice);
        }
      }
    } else {
      const attachmentsToProcess = payload.attachments.filter((attachment) => {
        const mimeType = attachment.contentType ?? "application/octet-stream";
        return shouldExtractAttachment(
          { filename: attachment.filename, mimeType, sizeBytes: attachment.size },
          emailContext,
        );
      });

      if (attachmentsToProcess.length > 0) {
        const batch = await tasks.batchTriggerAndWait<typeof processAttachment>(
          "process-attachment",
          attachmentsToProcess.map((attachment) => ({
            payload: {
              inboxId: payload.inboxId,
              messageId: payload.messageId,
              userId: inbox.user_id,
              sender: payload.sender,
              attachment,
            } satisfies ProcessAttachmentPayload,
            // A retry of process-inbound-email re-runs this whole function
            // from scratch, which would otherwise spawn a brand-new child
            // run per attachment on every retry. Keying by
            // messageId+attachmentId makes the retry reuse the same child
            // run instead of duplicating the download + extraction work.
            options: { idempotencyKey: `${payload.messageId}:${attachment.attachmentId}` },
          })),
        );

        // batch.runs is positional: Trigger.dev returns results in the same
        // order as the items array passed to batchTriggerAndWait, so zipping
        // by index recovers which attachment a given run belongs to (a
        // TaskRunResult carries the run's own id, not the original payload).
        batch.runs.forEach((run, index) => {
          if (!run.ok) {
            console.error(
              "Attachment processing failed after retries",
              payload.inboxId,
              payload.messageId,
              attachmentsToProcess[index]!.attachmentId,
              run.error,
            );
            anyAttachmentFailed = true;
          }
        });

        saved.push(...aggregateAttachmentResults(batch.runs));
      }
    }

    // This "error" reply and onFailure's "error" reply (above) can't both
    // fire for the same execution: reaching this line means run() completed,
    // which ends the retry chain and makes onFailure unreachable for this
    // attempt; onFailure only runs when every attempt throws, in which case
    // this line was never reached on any attempt. If code is ever added
    // after this point that could itself throw, re-check that invariant.
    const outcome: EmailReplyOutcome =
      saved.length > 0
        ? { type: "processed", invoices: saved }
        : anyAttachmentFailed
          ? { type: "error" }
          : { type: "skipped" };

    await triggerReply(payload.inboxId, payload.messageId, outcome, `reply:${payload.messageId}`);

    return {
      status:
        saved.length > 0
          ? ("processed" as const)
          : anyAttachmentFailed
            ? ("attachments_failed" as const)
            : ("skipped_non_invoice" as const),
      extracted: saved.length,
    };
  },
});
