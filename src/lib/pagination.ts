/** Parses a `?page=` search param, defaulting to 1 for anything invalid. */
export function parsePageParam(value: string | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

/** 0-indexed [from, to] range for Supabase's `.range()`, from a 1-indexed page. */
export function paginationRange(page: number, pageSize: number): { from: number; to: number } {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

/** Total pages for a given row count, never less than 1. */
export function pageCount(totalCount: number, pageSize: number): number {
  return Math.max(1, Math.ceil(totalCount / pageSize));
}
