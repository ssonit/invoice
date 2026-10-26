import { task } from "@trigger.dev/sdk";
import type { ProcessExtractionResult } from "@/lib/invoices/process-extraction";
import { downloadAndExtractAttachment } from "@/lib/inbound-email/download-and-extract-attachment";
import {
  EXTRACTION_CONCURRENCY_LIMIT,
  type ProcessAttachmentPayload,
} from "@/lib/inbound-email/types";

export type { ProcessAttachmentPayload };

// No onFailure here: a single attachment's exhausted retries aren't
// independently reported to anyone. process-inbound-email.ts's
// batchTriggerAndWait aggregation is where the overall outcome and the
// sender-facing reply are decided.
export const processAttachment = task({
  id: "process-attachment",
  queue: { concurrencyLimit: EXTRACTION_CONCURRENCY_LIMIT },
  retry: { maxAttempts: 3 },
  run: async (payload: ProcessAttachmentPayload): Promise<ProcessExtractionResult> =>
    downloadAndExtractAttachment(payload),
});
