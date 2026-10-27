import "server-only";
import { getAgentMailClient } from "@/lib/agentmail";
import { createServiceClient } from "@/lib/supabase/service";
import {
  processExtraction,
  type ProcessExtractionResult,
} from "@/lib/invoices/process-extraction";
import type { ProcessAttachmentPayload } from "./types";

/** Downloads one forwarded attachment from AgentMail and saves its invoice. */
export async function downloadAndExtractAttachment(
  payload: ProcessAttachmentPayload,
): Promise<ProcessExtractionResult> {
  const supabase = createServiceClient();
  const { attachment } = payload;
  const mimeType = attachment.contentType ?? "application/octet-stream";

  const { downloadUrl } = await getAgentMailClient().inboxes.messages.getAttachment(
    payload.inboxId,
    payload.messageId,
    attachment.attachmentId,
  );
  const fileRes = await fetch(downloadUrl);
  if (!fileRes.ok) {
    throw new Error(
      `Failed to download attachment ${attachment.attachmentId}: AgentMail returned ${fileRes.status} ${fileRes.statusText}`,
    );
  }
  const fileBuffer = Buffer.from(await fileRes.arrayBuffer());

  const input =
    mimeType === "application/pdf"
      ? ({ type: "pdf", data: fileBuffer } as const)
      : mimeType.startsWith("image/")
        ? ({ type: "image", data: fileBuffer, mimeType } as const)
        : null;
  // The caller's shouldExtractAttachment gate already restricts to pdf/image;
  // kept as a defensive fallback: silently not saved, not treated as a failure.
  if (!input) return { saved: false };

  return processExtraction({
    supabase,
    userId: payload.userId,
    messageId: payload.messageId,
    sender: payload.sender,
    sourceRef: attachment.attachmentId,
    input,
    fileBuffer,
    fileName: attachment.filename ?? attachment.attachmentId,
  });
}
