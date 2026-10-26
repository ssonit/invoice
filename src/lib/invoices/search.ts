import { escapeIlike } from "@/lib/vendors/query";

/**
 * Fold a search string the same way the DB does for `invoices.search_text`
 * (lower(unaccent(...))): lowercase, strip diacritics, đ → d. Lets "dien"
 * match "Điện" and "DE688" match "de688".
 */
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .trim();
}

/** ILIKE pattern for `invoices.search_text`, or null when nothing to search. */
export function buildInvoiceSearchPattern(raw: string): string | null {
  const folded = normalizeSearchText(raw);
  if (!folded) return null;
  return `%${escapeIlike(folded)}%`;
}
