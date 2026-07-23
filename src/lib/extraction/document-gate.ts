/**
 * Cheap, deterministic gate that runs before the LLM extractor.
 * Goal: skip obvious non-invoice / non-receipt mail & attachments so we
 * don't burn model tokens / latency on newsletters, logos, .docx, etc.
 */

export const MIN_IMAGE_BYTES_FOR_EXTRACTION = 12 * 1024; // skip tiny logos/signatures

const POSITIVE_PATTERNS: RegExp[] = [
  /\binvoice\b/i,
  /\breceipt\b/i,
  /\bbill(?:ing)?\b/i,
  /\bstatement\b/i,
  /\bpayment\s+(?:due|received|confirmation)\b/i,
  /\btax\s+invoice\b/i,
  /\bhoa[\s_-]?don\b/i,
  /\bh[oó]a[\s_-]?đ[oơ]n\b/i,
  /\bbi[eê]n[\s_-]?lai\b/i,
  /\bch[uứ]ng[\s_-]?t[uừ]\b/i,
  /\bthanh[\s_-]?to[aá]n\b/i,
  /\binv[-_]?\d/i,
  /\breceipt[-_]?\d/i,
];

const NEGATIVE_FILENAME_PATTERNS: RegExp[] = [
  /\blogo\b/i,
  /\bsignature\b/i,
  /\bavatar\b/i,
  /\bicon\b/i,
  /\bbanner\b/i,
  /\bunsubscribe\b/i,
  /\bsocial[-_]?share\b/i,
  /\.ics$/i,
  /\.vcf$/i,
  /\.zip$/i,
  /\.docx?$/i,
  /\.xlsx?$/i,
  /\.pptx?$/i,
  /\.csv$/i,
  /\.txt$/i,
];

const EXTRACTABLE_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

export type DocumentSignals = {
  subject?: string | null;
  text?: string | null;
  html?: string | null;
  filename?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
};

export function hasInvoiceOrReceiptSignals(
  ...parts: Array<string | null | undefined>
): boolean {
  const haystack = parts.filter(Boolean).join("\n");
  if (!haystack) return false;
  return POSITIVE_PATTERNS.some((re) => re.test(haystack));
}

export function isExtractableMimeType(mimeType: string | null | undefined): boolean {
  if (!mimeType) return false;
  const normalized = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  return EXTRACTABLE_MIME_TYPES.has(normalized) || normalized.startsWith("image/");
}

export function isLikelyDecorativeAttachment(signals: DocumentSignals): boolean {
  const filename = signals.filename ?? "";
  if (NEGATIVE_FILENAME_PATTERNS.some((re) => re.test(filename))) return true;

  const mime = (signals.mimeType ?? "").toLowerCase();
  const size = signals.sizeBytes ?? 0;
  if (mime.startsWith("image/") && size > 0 && size < MIN_IMAGE_BYTES_FOR_EXTRACTION) {
    return true;
  }
  return false;
}

/**
 * Decide whether an email body (no usable attachment) is worth sending to the LLM.
 * Requires invoice/receipt cues in subject or body.
 */
export function shouldExtractEmailBody(signals: {
  subject?: string | null;
  text?: string | null;
  html?: string | null;
}): boolean {
  return hasInvoiceOrReceiptSignals(signals.subject, signals.text, signals.html);
}

/**
 * Decide whether a single email attachment is worth downloading + extracting.
 * - Must be PDF or image
 * - Must not look like logo/signature/junk
 * - Must have invoice/receipt cues in filename OR in the parent email context
 *   (opaque names like scan.pdf are OK when the email itself looks like a bill)
 */
export function shouldExtractAttachment(
  attachment: DocumentSignals,
  emailContext: { subject?: string | null; text?: string | null; html?: string | null },
): boolean {
  if (!isExtractableMimeType(attachment.mimeType)) return false;
  if (isLikelyDecorativeAttachment(attachment)) return false;

  const mime = (attachment.mimeType ?? "").toLowerCase();
  const emailLooksRelevant = hasInvoiceOrReceiptSignals(
    emailContext.subject,
    emailContext.text,
    emailContext.html,
  );
  const fileLooksRelevant = hasInvoiceOrReceiptSignals(attachment.filename);

  // PDFs forwarded to the invoice inbox with no cues still often are invoices
  // (generic names like document.pdf). Allow those; images need a cue.
  if (mime === "application/pdf") {
    return true;
  }

  return emailLooksRelevant || fileLooksRelevant;
}
