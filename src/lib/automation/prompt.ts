/**
 * The instruction a user pastes into their own AI agent so it forwards only
 * invoice mail to their workspace address. One template for every agent —
 * agents differ in where you paste it, not in what it says.
 */
export function buildForwardPrompt(forwardAddress: string): string {
  const address = forwardAddress.trim();
  // Callers only render a prompt once an inbox exists, so an empty address is
  // a programming error, not an anticipated outcome — throw rather than
  // return a prompt that would silently forward nowhere.
  if (!address) {
    throw new Error("buildForwardPrompt requires a non-empty forwarding address");
  }

  return `Whenever you receive an invoice, tax invoice, receipt, supplier invoice or accounting document with a PDF or image attachment, automatically forward the original email to:

${address}

Rules:
- Preserve subject
- Keep all attachments
- Do not modify the email body
- Ignore newsletters and marketing emails
- If uncertain, do not forward`;
}
