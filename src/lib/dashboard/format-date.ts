import type { DashboardLocale } from "@/lib/dashboard/i18n";

// BCP 47 tags for Intl, keyed by the dashboard's two-letter locale.
export const INTL_LOCALE: Record<DashboardLocale, string> = {
  en: "en-US",
  vi: "vi-VN",
};

export const DEFAULT_INTL_LOCALE = INTL_LOCALE.en;
export const FALLBACK_TIME_ZONE = "UTC";

// Intl on newer ICU builds emits a narrow no-break space before AM/PM.
function normalizeSpaces(value: string): string {
  return value.replace(/[  ]/g, " ");
}

/** Short month name ("Jul" / "thg 7") for the month containing `date` (UTC). */
export function formatShortMonth(date: Date, locale: string = DEFAULT_INTL_LOCALE): string {
  return normalizeSpaces(
    new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(date),
  );
}

/** Calendar date with no timezone shift: the inputs are already a civil date. */
export function formatCalendarDate(
  parts: { year: number; month: number; day: number },
  locale: string = DEFAULT_INTL_LOCALE,
): string {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return normalizeSpaces(
    new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(date),
  );
}

/** Month + day (no year) of an instant, in the viewer's time zone. */
export function formatMonthDay(
  date: Date,
  locale: string = DEFAULT_INTL_LOCALE,
  timeZone: string = FALLBACK_TIME_ZONE,
): string {
  return normalizeSpaces(
    new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone }).format(date),
  );
}

/** Full date of an instant, in the viewer's time zone. */
export function formatFullDate(
  date: Date,
  locale: string = DEFAULT_INTL_LOCALE,
  timeZone: string = FALLBACK_TIME_ZONE,
): string {
  return normalizeSpaces(
    new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone,
    }).format(date),
  );
}

/** Clock time of an instant, in the viewer's time zone. */
export function formatClockTime(
  date: Date,
  locale: string = DEFAULT_INTL_LOCALE,
  timeZone: string = FALLBACK_TIME_ZONE,
): string {
  return normalizeSpaces(
    new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone }).format(date),
  );
}

/** Stable YYYY-MM-DD key for the calendar day an instant falls on in `timeZone`. */
export function dayKeyInTimeZone(date: Date, timeZone: string = FALLBACK_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).format(date);
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Day key of the day before `date`'s day in `timeZone` (DST-safe via noon anchor). */
export function previousDayKeyInTimeZone(date: Date, timeZone: string = FALLBACK_TIME_ZONE): string {
  const [year, month, day] = dayKeyInTimeZone(date, timeZone).split("-").map(Number);
  const noonUtc = Date.UTC(year, month - 1, day, 12);
  return dayKeyInTimeZone(new Date(noonUtc - MS_PER_DAY), "UTC");
}
