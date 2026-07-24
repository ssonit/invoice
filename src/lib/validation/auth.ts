import { z } from "zod";

// Server-side validation for the login/signup Server Actions. Browser
// `required`/`minLength` attributes are UX only and can be bypassed, so
// these are the actual enforcement point.

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const signupSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(6, "Use at least 6 characters"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;

export type FormValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}

export function parseLoginForm(formData: FormData): FormValidationResult<LoginInput> {
  const result = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!result.success) {
    return { success: false, error: firstIssueMessage(result.error) };
  }
  return { success: true, data: result.data };
}

export function parseSignupForm(formData: FormData): FormValidationResult<SignupInput> {
  const result = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!result.success) {
    return { success: false, error: firstIssueMessage(result.error) };
  }
  return { success: true, data: result.data };
}

export const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export function parseForgotPasswordForm(
  formData: FormData,
): FormValidationResult<ForgotPasswordInput> {
  const result = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!result.success) {
    return { success: false, error: firstIssueMessage(result.error) };
  }
  return { success: true, data: result.data };
}

// Also reused by the account-settings "change password" form (Task 8) — same
// shape, no reason to duplicate it.
export const resetPasswordSchema = z.object({
  password: z.string().min(6, "Use at least 6 characters"),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export function parseResetPasswordForm(
  formData: FormData,
): FormValidationResult<ResetPasswordInput> {
  const result = resetPasswordSchema.safeParse({ password: formData.get("password") });
  if (!result.success) {
    return { success: false, error: firstIssueMessage(result.error) };
  }
  return { success: true, data: result.data };
}
