export const SUBSCRIPTION_CONFIRMATION_STATUS = {
  ACTIVE: "active",
  CANCELLED: "cancelled",
} as const

export type SubscriptionConfirmationStatus =
  (typeof SUBSCRIPTION_CONFIRMATION_STATUS)[keyof typeof SUBSCRIPTION_CONFIRMATION_STATUS]

export const SUBSCRIPTION_CYCLE = {
  MONTHLY: "monthly",
  YEARLY: "yearly",
} as const

export type SubscriptionCycleConstant =
  (typeof SUBSCRIPTION_CYCLE)[keyof typeof SUBSCRIPTION_CYCLE]

export const SUBSCRIPTION_CYCLE_LABELS: Record<SubscriptionCycleConstant, string> = {
  [SUBSCRIPTION_CYCLE.MONTHLY]: "Monthly",
  [SUBSCRIPTION_CYCLE.YEARLY]: "Yearly",
}
