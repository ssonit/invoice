const EMAIL_ADDRESS = /[^\s<>"',;]+@[^\s<>"',;]+\.[^\s<>"',;]+/;

/**
 * Pulls the bare email address out of an AgentMail `from` value: a plain
 * address ("a@b.com"), a display-name form ("Web Tester <a@b.com>"), or a list
 * of either (first entry wins). Returns null when no address is present.
 */
export function extractSenderAddress(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const address = extractSenderAddress(entry);
      if (address) return address;
    }
    return null;
  }
  if (typeof value !== "string") return null;
  const match = EMAIL_ADDRESS.exec(value);
  return match ? match[0].toLowerCase() : null;
}
