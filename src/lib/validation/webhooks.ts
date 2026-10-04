import { type ValidationResult } from "@/lib/validation/common";

// JSON-parsing helper for webhook bodies, used by the AgentMail webhook route.

export function parseWebhookJson(rawBody: string): ValidationResult<unknown> {
  try {
    return { success: true, data: JSON.parse(rawBody) };
  } catch {
    return { success: false, error: "Invalid JSON payload" };
  }
}
