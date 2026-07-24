import { parsePageParam } from "@/lib/pagination";

export const INVOICE_LIST_PAGE_SIZE = 20;

export type InvoiceListStatus = "all" | "review" | "ok";

export type InvoiceListQuery = {
  page: number;
  vendor: string;
  status: InvoiceListStatus;
};

const VENDOR_SEARCH_MAX_LENGTH = 100;
const STATUS_VALUES = new Set<string>(["all", "review", "ok"]);

export function parseInvoiceListQuery(params: {
  page?: string;
  vendor?: string;
  status?: string;
}): InvoiceListQuery {
  return {
    page: parsePageParam(params.page),
    vendor: (params.vendor ?? "").trim().slice(0, VENDOR_SEARCH_MAX_LENGTH),
    status: STATUS_VALUES.has(params.status ?? "")
      ? (params.status as InvoiceListStatus)
      : "all",
  };
}

export function isDefaultInvoiceListQuery(query: InvoiceListQuery): boolean {
  return query.page === 1 && query.vendor.length === 0 && query.status === "all";
}
