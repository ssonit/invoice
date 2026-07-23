export const VENDOR_FILTER = {
  ALL: "all",
  HAS_INVOICES: "has_invoices",
  NO_INVOICES: "no_invoices",
  SUBSCRIPTION: "subscription",
  NO_SUBSCRIPTION: "no_subscription",
  NEEDS_CONFIRMATION: "needs_confirmation",
  CANCELLED: "cancelled",
} as const

export type VendorFilter = (typeof VENDOR_FILTER)[keyof typeof VENDOR_FILTER]

export const VENDOR_SORT = {
  TOTAL_DESC: "total_desc",
  TOTAL_ASC: "total_asc",
  NAME_ASC: "name_asc",
  NAME_DESC: "name_desc",
  COUNT_DESC: "count_desc",
  COUNT_ASC: "count_asc",
  LAST_DESC: "last_desc",
  LAST_ASC: "last_asc",
  CREATED_DESC: "created_desc",
  CREATED_ASC: "created_asc",
} as const

export type VendorSort = (typeof VENDOR_SORT)[keyof typeof VENDOR_SORT]

export const VENDOR_FILTER_OPTIONS: ReadonlyArray<{
  value: VendorFilter
  label: string
}> = [
  { value: VENDOR_FILTER.ALL, label: "All vendors" },
  { value: VENDOR_FILTER.HAS_INVOICES, label: "Has invoices" },
  { value: VENDOR_FILTER.NO_INVOICES, label: "No invoices" },
  { value: VENDOR_FILTER.SUBSCRIPTION, label: "Has subscription" },
  { value: VENDOR_FILTER.NO_SUBSCRIPTION, label: "No subscription" },
  { value: VENDOR_FILTER.NEEDS_CONFIRMATION, label: "Needs confirmation" },
  { value: VENDOR_FILTER.CANCELLED, label: "Cancelled" },
]

export const VENDOR_SORT_OPTIONS: ReadonlyArray<{
  value: VendorSort
  label: string
}> = [
  { value: VENDOR_SORT.TOTAL_DESC, label: "Total spent (high → low)" },
  { value: VENDOR_SORT.TOTAL_ASC, label: "Total spent (low → high)" },
  { value: VENDOR_SORT.NAME_ASC, label: "Name (A → Z)" },
  { value: VENDOR_SORT.NAME_DESC, label: "Name (Z → A)" },
  { value: VENDOR_SORT.COUNT_DESC, label: "Invoice count (high → low)" },
  { value: VENDOR_SORT.COUNT_ASC, label: "Invoice count (low → high)" },
  { value: VENDOR_SORT.LAST_DESC, label: "Last invoice (newest)" },
  { value: VENDOR_SORT.LAST_ASC, label: "Last invoice (oldest)" },
  { value: VENDOR_SORT.CREATED_DESC, label: "Recently added" },
  { value: VENDOR_SORT.CREATED_ASC, label: "Oldest added" },
]

export const VENDOR_DEFAULT_FILTER = VENDOR_FILTER.ALL
export const VENDOR_DEFAULT_SORT = VENDOR_SORT.TOTAL_DESC

export const VENDOR_SEARCH_MAX_LENGTH = 100
export const VENDOR_SEARCH_DEBOUNCE_MS = 300
export const VENDOR_LIST_PAGE_SIZE = 10

export const VENDOR_FILTER_LABELS: Record<VendorFilter, string> = Object.fromEntries(
  VENDOR_FILTER_OPTIONS.map((o) => [o.value, o.label]),
) as Record<VendorFilter, string>

export const VENDOR_SORT_LABELS: Record<VendorSort, string> = Object.fromEntries(
  VENDOR_SORT_OPTIONS.map((o) => [o.value, o.label]),
) as Record<VendorSort, string>
