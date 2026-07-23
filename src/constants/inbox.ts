export const INBOX_STATUS_FILTER = {
  ALL: "all",
  REVIEW: "review",
  EXTRACTED: "extracted",
  APPROVED: "approved",
} as const

export type InboxStatusFilter =
  (typeof INBOX_STATUS_FILTER)[keyof typeof INBOX_STATUS_FILTER]

export const INBOX_SOURCE_FILTER = {
  ALL: "all",
  EMAIL: "email",
  UPLOAD: "upload",
} as const

export type InboxSourceFilter =
  (typeof INBOX_SOURCE_FILTER)[keyof typeof INBOX_SOURCE_FILTER]

export const INBOX_STATUS_FILTER_OPTIONS: ReadonlyArray<{
  value: InboxStatusFilter
  label: string
}> = [
  { value: INBOX_STATUS_FILTER.ALL, label: "All statuses" },
  { value: INBOX_STATUS_FILTER.REVIEW, label: "Review" },
  { value: INBOX_STATUS_FILTER.EXTRACTED, label: "Extracted" },
  { value: INBOX_STATUS_FILTER.APPROVED, label: "Approved" },
]

export const INBOX_SOURCE_FILTER_OPTIONS: ReadonlyArray<{
  value: InboxSourceFilter
  label: string
}> = [
  { value: INBOX_SOURCE_FILTER.ALL, label: "All sources" },
  { value: INBOX_SOURCE_FILTER.EMAIL, label: "Email" },
  { value: INBOX_SOURCE_FILTER.UPLOAD, label: "Upload" },
]

export const INBOX_DEFAULT_STATUS_FILTER = INBOX_STATUS_FILTER.ALL
export const INBOX_DEFAULT_SOURCE_FILTER = INBOX_SOURCE_FILTER.ALL
export const INBOX_LIST_PAGE_SIZE = 8
