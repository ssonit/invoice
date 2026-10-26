import { z } from "zod";
import { NAME_MAX_LENGTH } from "@/constants/validation";
import { emailSchema, type ValidationResult } from "@/lib/validation/common";

export const deleteAccountSchema = z.object({
  confirmEmail: emailSchema,
});

export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}

export const displayNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(NAME_MAX_LENGTH, "Name is too long"),
});

export function parseDisplayNameForm(
  formData: FormData,
): ValidationResult<{ name: string }> {
  const result = displayNameSchema.safeParse({ name: formData.get("name") });
  if (!result.success) return { success: false, error: firstIssue(result.error) };
  return { success: true, data: result.data };
}

export function parseDeleteAccountInput(input: {
  confirmEmail: unknown;
}): ValidationResult<DeleteAccountInput> {
  const result = deleteAccountSchema.safeParse(input);
  if (!result.success) return { success: false, error: firstIssue(result.error) };
  return { success: true, data: result.data };
}
