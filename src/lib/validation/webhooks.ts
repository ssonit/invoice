import { type ValidationResult } from "@/lib/validation/common";

// Polar webhook payloads are verified by the official SDK's validateEvent()
// (standardwebhooks under the hood), which returns typed payload objects.
// This file keeps the parseWebhookJson() helper for JSON parsing, shared
// with the AgentMail webhook route.

export function parseWebhookJson(rawBody: string): ValidationResult<unknown> {
  try {
    return { success: true, data: JSON.parse(rawBody) };
  } catch {
    return { success: false, error: "Invalid JSON payload" };
  }
}
