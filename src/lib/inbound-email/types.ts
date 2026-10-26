export type InboundAttachment = {
  attachmentId: string;
  filename: string | null;
  contentType: string | null;
  size: number | null;
};

export type ProcessInboundEmailPayload = {
  inboxId: string;
  messageId: string;
  subject: string | null;
  text: string | null;
  html: string | null;
  attachments: InboundAttachment[];
};

export type ProcessAttachmentPayload = {
  inboxId: string;
  messageId: string;
  userId: string;
  attachment: InboundAttachment;
};

// Concurrent LLM calls + Supabase writes. Caps both the Trigger.dev attachment
// queue and the inline (no-Trigger) path.
export const EXTRACTION_CONCURRENCY_LIMIT = 5;
