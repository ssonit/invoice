import type { SavedInvoiceSummary } from "./process-extraction";
import type { EmailReplyOutcome } from "../email-reply-templates";

/**
 * Decides the auto-reply outcome for process-inbound-email's onFailure hook.
 * onFailure fires once, after every retry attempt of the whole task has
 * thrown — but an earlier attempt may have already upserted some
 * attachments before a later attempt kept failing. Reporting "error"
 * unconditionally would tell the sender nothing was saved when some
 * invoices are actually sitting in their dashboard.
 */
export function buildFailureOutcome(saved: SavedInvoiceSummary[]): EmailReplyOutcome {
  return saved.length > 0 ? { type: "processed", invoices: saved } : { type: "error" };
}
