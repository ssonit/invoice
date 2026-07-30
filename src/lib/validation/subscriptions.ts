import { z } from "zod";
import { SUBSCRIPTION_CONFIRMATION_STATUS, SUBSCRIPTION_CYCLE } from "@/constants/subscriptions";
import { vendorKeySchema } from "@/lib/validation/common";

export const confirmSubscriptionSchema = z.object({
  vendorKey: vendorKeySchema,
  status: z.enum([
    SUBSCRIPTION_CONFIRMATION_STATUS.ACTIVE,
    SUBSCRIPTION_CONFIRMATION_STATUS.CANCELLED,
  ]),
});

export type ConfirmSubscriptionInput = z.infer<typeof confirmSubscriptionSchema>;

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export function parseConfirmSubscriptionInput(
  input: unknown,
): ValidationResult<ConfirmSubscriptionInput> {
  const result = confirmSubscriptionSchema.safeParse(input);
  if (!result.success) {
    return { success: false, error: result.error.issues[0]?.message ?? "Invalid input" };
  }
  return { success: true, data: result.data };
}

export const markSubscriptionSchema = z.object({
  vendorKey: vendorKeySchema,
  cycle: z.enum([SUBSCRIPTION_CYCLE.MONTHLY, SUBSCRIPTION_CYCLE.YEARLY]),
});

export type MarkSubscriptionInput = z.infer<typeof markSubscriptionSchema>;

export function parseMarkSubscriptionInput(
  input: unknown,
): ValidationResult<MarkSubscriptionInput> {
  const result = markSubscriptionSchema.safeParse(input);
  if (!result.success) {
    return { success: false, error: result.error.issues[0]?.message ?? "Invalid input" };
  }
  return { success: true, data: result.data };
}
