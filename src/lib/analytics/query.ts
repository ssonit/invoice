export type AnalyticsRange = 6 | 12;

export type AnalyticsQuery = {
  range: AnalyticsRange;
};

const DEFAULT_RANGE: AnalyticsRange = 6;

function clampRange(raw: number): AnalyticsRange {
  if (raw <= 6) return 6;
  if (raw >= 12) return 12;
  // Between 6 and 12 (exclusive) — shouldn't happen with current UI, pick nearest
  return raw - 6 < 12 - raw ? 6 : 12;
}

export function parseAnalyticsQuery(params: {
  range?: string;
}): AnalyticsQuery {
  const raw = Number(params.range);
  const range = Number.isNaN(raw) ? DEFAULT_RANGE : clampRange(raw);
  return { range };
}

export function buildAnalyticsHref(query: AnalyticsQuery): string {
  if (query.range === DEFAULT_RANGE) {
    return "/dashboard/analytics";
  }
  return `/dashboard/analytics?range=${query.range}`;
}

export function rangeStartIso(now: Date, months: number): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString();
}
