import { z } from "zod";
import { emailSchema, type ValidationResult } from "@/lib/validation/common";

export const deleteAccountSchema = z.object({
  confirmEmail: emailSchema,
});

export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}

export function parseDeleteAccountInput(input: {
  confirmEmail: unknown;
}): ValidationResult<DeleteAccountInput> {
  const result = deleteAccountSchema.safeParse(input);
  if (!result.success) return { success: false, error: firstIssue(result.error) };
  return { success: true, data: result.data };
}
