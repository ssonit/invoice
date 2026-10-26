import type { ProcessInboundEmailPayload } from "./types";

type RawRecord = Record<string, unknown>;

function isRecord(value: unknown): value is RawRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** First non-empty string among the given keys (AgentMail sends snake_case JSON; the SDK types are camelCase). */
function pickString(source: RawRecord, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

function pickNumber(source: RawRecord, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

/**
 * Turns the `message` object of an AgentMail `message.received` webhook into the
 * payload the processing pipeline expects. The raw webhook body is snake_case
 * (`inbox_id`, `message_id`, `attachment_id`, `content_type`) — reading the
 * camelCase SDK field names off it yields undefined — so both spellings are accepted.
 * Returns null when the inbox or message id is missing.
 */
export function parseWebhookMessage(message: unknown): ProcessInboundEmailPayload | null {
  if (!isRecord(message)) return null;

  const inboxId = pickString(message, "inbox_id", "inboxId");
  const messageId = pickString(message, "message_id", "messageId");
  if (!inboxId || !messageId) return null;

  const rawAttachments = Array.isArray(message.attachments) ? message.attachments : [];
  const attachments = rawAttachments.filter(isRecord).flatMap((attachment) => {
    const attachmentId = pickString(attachment, "attachment_id", "attachmentId");
    if (!attachmentId) return [];
    return [
      {
        attachmentId,
        filename: pickString(attachment, "filename"),
        contentType: pickString(attachment, "content_type", "contentType"),
        size: pickNumber(attachment, "size"),
      },
    ];
  });

  return {
    inboxId,
    messageId,
    subject: pickString(message, "subject"),
    text: pickString(message, "text", "extracted_text", "extractedText"),
    html: pickString(message, "html", "extracted_html", "extractedHtml"),
    attachments,
  };
}
