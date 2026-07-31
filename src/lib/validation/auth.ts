import { z } from "zod";
import { NAME_MAX_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/constants/validation";
import { emailSchema } from "@/lib/validation/common";

// Server-side validation for the login/signup Server Actions. Browser
// `required`/`minLength` attributes are UX only and can be bypassed, so
// these are the actual enforcement point.

const passwordSchema = z
  .string()
  .min(1, "Password is required")
  .max(PASSWORD_MAX_LENGTH, "Password is too long");

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const signupSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Name is required")
      .max(NAME_MAX_LENGTH, "Name is too long"),
    email: emailSchema,
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
      .max(PASSWORD_MAX_LENGTH, "Password is too long"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
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
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!result.success) {
    return { success: false, error: firstIssueMessage(result.error) };
  }
  return { success: true, data: result.data };
}

export const forgotPasswordSchema = z.object({
  email: emailSchema,
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
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
    .max(PASSWORD_MAX_LENGTH, "Password is too long"),
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
