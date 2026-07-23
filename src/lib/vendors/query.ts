import {
  VENDOR_DEFAULT_FILTER,
  VENDOR_DEFAULT_SORT,
  VENDOR_FILTER,
  VENDOR_FILTER_LABELS,
  VENDOR_FILTER_OPTIONS,
  VENDOR_SEARCH_MAX_LENGTH,
  VENDOR_SORT,
  VENDOR_SORT_LABELS,
  VENDOR_SORT_OPTIONS,
  type VendorFilter,
  type VendorSort,
} from "@/constants/vendors"

export type { VendorFilter, VendorSort }

export const VENDOR_FILTERS = VENDOR_FILTER_OPTIONS.map((o) => o.value)
export const VENDOR_SORTS = VENDOR_SORT_OPTIONS.map((o) => o.value)

export type VendorQuery = {
  q: string
  filter: VendorFilter
  sort: VendorSort
}

const FILTER_SET = new Set<string>(VENDOR_FILTERS)
const SORT_SET = new Set<string>(VENDOR_SORTS)

export function parseVendorQuery(params: {
  q?: string
  filter?: string
  sort?: string
}): VendorQuery {
  const q = (params.q ?? "").trim().slice(0, VENDOR_SEARCH_MAX_LENGTH)
  const filter = FILTER_SET.has(params.filter ?? "")
    ? (params.filter as VendorFilter)
    : VENDOR_DEFAULT_FILTER
  const sort = SORT_SET.has(params.sort ?? "")
    ? (params.sort as VendorSort)
    : VENDOR_DEFAULT_SORT
  return { q, filter, sort }
}

/** Escape LIKE wildcards so user input is matched literally. */
export function escapeIlike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")
}

export function vendorFilterLabel(filter: VendorFilter): string {
  return VENDOR_FILTER_LABELS[filter]
}

export function vendorSortLabel(sort: VendorSort): string {
  return VENDOR_SORT_LABELS[sort]
}

export function isDefaultVendorQuery(query: VendorQuery): boolean {
  return (
    query.q.length === 0 &&
    query.filter === VENDOR_DEFAULT_FILTER &&
    query.sort === VENDOR_DEFAULT_SORT
  )
}

export {
  VENDOR_DEFAULT_FILTER,
  VENDOR_DEFAULT_SORT,
  VENDOR_FILTER,
  VENDOR_SORT,
  VENDOR_FILTER_OPTIONS,
  VENDOR_SORT_OPTIONS,
}
