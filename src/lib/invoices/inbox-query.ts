import { parsePageParam } from "@/lib/pagination";
import {
  INBOX_SEARCH_MAX_LENGTH,
  type InboxSourceFilter,
  type InboxStatusFilter,
} from "@/constants/inbox";

export type InboxListQuery = {
  page: number;
  q: string;
  status: InboxStatusFilter;
  source: InboxSourceFilter;
};

const STATUS_VALUES = new Set<string>(["all", "review", "extracted", "approved"]);
const SOURCE_VALUES = new Set<string>(["all", "email", "upload"]);

export function parseInboxListQuery(params: {
  page?: string;
  q?: string;
  status?: string;
  source?: string;
}): InboxListQuery {
  return {
    page: parsePageParam(params.page),
    q: (params.q ?? "").trim().slice(0, INBOX_SEARCH_MAX_LENGTH),
    status: STATUS_VALUES.has(params.status ?? "")
      ? (params.status as InboxStatusFilter)
      : "all",
    source: SOURCE_VALUES.has(params.source ?? "")
      ? (params.source as InboxSourceFilter)
      : "all",
  };
}

export function isDefaultInboxListQuery(query: InboxListQuery): boolean {
  return (
    query.page === 1 &&
    query.q.length === 0 &&
    query.status === "all" &&
    query.source === "all"
  );
}
