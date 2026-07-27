import { z } from "zod";
import { type ValidationResult } from "@/lib/validation/common";

const billingStatusSchema = z.enum([
  "on_trial",
  "active",
  "paused",
  "past_due",
  "unpaid",
  "cancelled",
  "expired",
]);

export const lemonSqueezyWebhookSchema = z.object({
  meta: z.object({
    event_name: z.string().min(1),
    custom_data: z
      .object({
        user_id: z.string().uuid().optional(),
      })
      .optional(),
  }),
  data: z.object({
    id: z.string().min(1),
    attributes: z.object({
      status: billingStatusSchema,
      customer_id: z.number(),
      renews_at: z.string().nullable(),
      ends_at: z.string().nullable(),
      urls: z.object({
        customer_portal: z.string().url(),
      }),
    }),
  }),
});

export type LemonSqueezyWebhookEvent = z.infer<typeof lemonSqueezyWebhookSchema>;

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid webhook payload";
}

export function parseWebhookJson(rawBody: string): ValidationResult<unknown> {
  try {
    return { success: true, data: JSON.parse(rawBody) };
  } catch {
    return { success: false, error: "Invalid JSON payload" };
  }
}

export function parseLemonSqueezyWebhook(
  input: unknown,
): ValidationResult<LemonSqueezyWebhookEvent> {
  const result = lemonSqueezyWebhookSchema.safeParse(input);
  if (!result.success) return { success: false, error: firstIssue(result.error) };
  return { success: true, data: result.data };
}
