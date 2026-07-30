import { task } from "@trigger.dev/sdk";
import { agentmail } from "@/lib/agentmail";
import { createServiceClient } from "@/lib/supabase/service";
import {
  processExtraction,
  type ProcessExtractionResult,
} from "@/lib/invoices/process-extraction";

export type ProcessAttachmentPayload = {
  inboxId: string;
  messageId: string;
  userId: string;
  attachment: {
    attachmentId: string;
    filename: string | null;
    contentType: string | null;
    size: number | null;
  };
};

// Concurrent LLM calls + Supabase writes across the whole system. Each
// attachment is now its own task run rather than one email looping over all
// of its attachments, so this is the queue that actually needs the cap —
// moved here from process-inbound-email.ts for that reason.
export const EXTRACTION_CONCURRENCY_LIMIT = 5;

// No onFailure here: a single attachment's exhausted retries aren't
// independently reported to anyone. process-inbound-email.ts's
// batchTriggerAndWait aggregation is where the overall outcome and the
// sender-facing reply are decided.
export const processAttachment = task({
  id: "process-attachment",
  queue: { concurrencyLimit: EXTRACTION_CONCURRENCY_LIMIT },
  retry: { maxAttempts: 3 },
  run: async (payload: ProcessAttachmentPayload): Promise<ProcessExtractionResult> => {
    const supabase = createServiceClient();
    const { attachment } = payload;
    const mimeType = attachment.contentType ?? "application/octet-stream";

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
    // Unreachable in practice today (the parent's shouldExtractAttachment
    // gate already restricts to pdf/image mime types before this task is
    // ever triggered), kept as a defensive fallback matching the original
    // loop's behavior: silently not saved, not treated as a failure.
    if (!input) return { saved: false };

    return processExtraction({
      supabase,
      userId: payload.userId,
      messageId: payload.messageId,
      sourceRef: attachment.attachmentId,
      input,
      fileBuffer,
      fileName: attachment.filename ?? attachment.attachmentId,
    });
  },
});
