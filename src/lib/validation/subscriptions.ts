import { z } from "zod";
import { SUBSCRIPTION_CONFIRMATION_STATUS } from "@/constants/subscriptions";

export const confirmSubscriptionSchema = z.object({
  vendorKey: z.string().trim().min(1, "vendorKey is required").max(200),
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
