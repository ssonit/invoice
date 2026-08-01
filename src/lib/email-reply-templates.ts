export type ReplyInvoiceSummary = {
  vendor: string | null;
  amount: number | null;
  currency: string | null;
};

export type EmailReplyOutcome =
  | { type: "processed"; invoices: ReplyInvoiceSummary[] }
  | { type: "skipped" }
  | { type: "quota_exceeded"; used: number; limit: number; resetsAt: string }
  | { type: "error" };

function formatAmount(amount: number | null, currency: string | null): string | null {
  if (amount === null) return null;
  return currency ? `${amount} ${currency}` : `${amount}`;
}

export function buildReplyText(outcome: EmailReplyOutcome): string {
  switch (outcome.type) {
    case "processed": {
      const { invoices } = outcome;
      if (invoices.length === 1) {
        const invoice = invoices[0]!;
        const vendor = invoice.vendor ?? "your vendor";
        const amount = formatAmount(invoice.amount, invoice.currency);
        const lead = amount
          ? `We received and processed your invoice from ${vendor} — ${amount}.`
          : `We received and processed your invoice from ${vendor}.`;
        return `${lead} You can view it in your Invoice Reader dashboard.`;
      }
      return `We received and processed ${invoices.length} invoices from this email. You can view them in your Invoice Reader dashboard.`;
    }
    case "skipped":
      return "We received your email but couldn't find an invoice to process. If you expected one here, please check the attachment and resend.";
    case "quota_exceeded": {
      const resetDate = new Date(outcome.resetsAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
      });
      return (
        `You've reached your Starter plan limit of ${outcome.limit} invoices this month ` +
        `(${outcome.used}/${outcome.limit}). Your quota resets on ${resetDate}. ` +
        `Upgrade to the Team plan for unlimited invoices — visit your dashboard to upgrade.`
      );
    }
    case "error":
      return "We ran into a problem processing this email. Please try resending it in a little while, or reach out if this keeps happening.";
  }
}
