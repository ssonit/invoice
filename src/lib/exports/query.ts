export type ExportRange = 6 | 12 | "all";

export type ExportStatus = "all" | "review" | "ok";

export type ExportQuery = {
  range: ExportRange;
  status: ExportStatus;
};

const DEFAULT_RANGE: ExportRange = 6;
const DEFAULT_STATUS: ExportStatus = "all";

const RANGE_VALUES = new Set<string>(["6", "12", "all"]);
const STATUS_VALUES = new Set<string>(["all", "review", "ok"]);

export function parseExportQuery(params: {
  range?: string;
  status?: string;
}): ExportQuery {
  const rawRange = params.range ?? "";
  const range: ExportRange = RANGE_VALUES.has(rawRange)
    ? ((Number(rawRange) || rawRange) as ExportRange)
    : DEFAULT_RANGE;

  const rawStatus = params.status ?? "";
  const status: ExportStatus = STATUS_VALUES.has(rawStatus)
    ? (rawStatus as ExportStatus)
    : DEFAULT_STATUS;

  return { range, status };
}

export function buildExportHref(query: ExportQuery): string {
  const params = new URLSearchParams();
  if (query.range !== DEFAULT_RANGE) params.set("range", String(query.range));
  if (query.status !== DEFAULT_STATUS) params.set("status", query.status);
  const qs = params.toString();
  return qs ? `/api/exports/invoices?${qs}` : "/api/exports/invoices";
}

/** First-of-month UTC ISO string `months` months ago. */
export function rangeStartIso(now: Date, months: number): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString();
}
