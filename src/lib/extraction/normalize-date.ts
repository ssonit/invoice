import type { InvoiceExtraction } from "./schema";

// Models are asked for ISO 8601 dates but sometimes echo the document's own
// format ("26/10/2026", "ngày 26 tháng 10 năm 2026"). Postgres rejects those
// for the `date` columns and the whole invoice fails to save, so normalize
// here and fall back to null — a missing date is better than a lost invoice.

const ISO_DATE = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/;
const DAY_FIRST_DATE = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/;
const VIETNAMESE_DATE = /ng[àa]y\s+(\d{1,2})\s+th[áa]ng\s+(\d{1,2})\s+n[ăa]m\s+(\d{4})/i;

function toIsoDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  const isRealDate =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
  if (!isRealDate) return null;
  return date.toISOString().slice(0, 10);
}

/**
 * Returns a `YYYY-MM-DD` string, or null if the value can't be read as a real
 * calendar date. Slash/dot/dash dates are read day-first (the Vietnamese
 * convention) unless that is impossible and month-first is valid.
 */
export function normalizeExtractedDate(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;

  const iso = ISO_DATE.exec(text);
  if (iso) return toIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const vietnamese = VIETNAMESE_DATE.exec(text);
  if (vietnamese) {
    return toIsoDate(Number(vietnamese[3]), Number(vietnamese[2]), Number(vietnamese[1]));
  }

  const dayFirst = DAY_FIRST_DATE.exec(text);
  if (dayFirst) {
    const [first, second, year] = [Number(dayFirst[1]), Number(dayFirst[2]), Number(dayFirst[3])];
    return toIsoDate(year, second, first) ?? toIsoDate(year, first, second);
  }

  return null;
}

export function normalizeExtractionDates(extraction: InvoiceExtraction): InvoiceExtraction {
  return {
    ...extraction,
    issue_date: normalizeExtractedDate(extraction.issue_date),
    due_date: normalizeExtractedDate(extraction.due_date),
  };
}
