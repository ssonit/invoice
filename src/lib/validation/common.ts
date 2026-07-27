import { z } from "zod";
import {
  EMAIL_MAX_LENGTH,
  MAX_UPLOAD_FORM_FIELDS,
  UPLOAD_FILENAME_MAX_LENGTH,
  VENDOR_KEY_MAX_LENGTH,
} from "@/constants/validation";
import { validateUploadFile } from "@/lib/validation/upload";

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}

/** Relative in-app paths only — blocks open redirects (`//evil`, `https://…`). */
export function isSafeRelativePath(path: string): boolean {
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (path.includes("://")) return false;
  if (path.includes("\\")) return false;
  if (path.includes("\0")) return false;
  return true;
}

export function parseSafeRedirectPath(
  path: string | null | undefined,
  fallback: string,
): string {
  const raw = (path ?? "").trim();
  if (!raw) return fallback;
  return isSafeRelativePath(raw) ? raw : fallback;
}

/** Fast reject when Content-Length is present and invalid or over limit. */
export function checkContentLength(
  request: Request,
  maxBytes: number,
): ValidationResult<null> {
  const header = request.headers.get("content-length");
  if (header === null) return { success: true, data: null };

  const bytes = Number(header);
  if (!Number.isFinite(bytes) || bytes < 0) {
    return { success: false, error: "Invalid Content-Length" };
  }
  if (bytes > maxBytes) {
    return { success: false, error: "Request payload is too large" };
  }
  return { success: true, data: null };
}

export function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "file";
  const cleaned = base.replace(/[\x00-\x1f\x7f]/g, "").trim();
  if (!cleaned) return "upload";
  return cleaned.slice(0, UPLOAD_FILENAME_MAX_LENGTH);
}

export const vendorKeySchema = z
  .string()
  .trim()
  .min(1, "vendorKey is required")
  .max(VENDOR_KEY_MAX_LENGTH, "vendorKey is too long");

export function parseVendorKeyInput(input: unknown): ValidationResult<{ vendorKey: string }> {
  const result = vendorKeySchema.safeParse(input);
  if (!result.success) return { success: false, error: firstIssue(result.error) };
  return { success: true, data: { vendorKey: result.data } };
}

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .max(EMAIL_MAX_LENGTH, "Email is too long")
  .email("Enter a valid email");

export type ParsedUploadForm = {
  file: File;
  sanitizedFilename: string;
  mimeType: string;
};

export function parseUploadForm(formData: FormData): ValidationResult<ParsedUploadForm> {
  const keys = [...formData.keys()];
  if (keys.length === 0 || keys.length > MAX_UPLOAD_FORM_FIELDS) {
    return { success: false, error: "Invalid form data" };
  }
  if (keys.some((key) => key !== "file")) {
    return { success: false, error: "Invalid form data" };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { success: false, error: "missing file" };
  }

  const mimeType = file.type || "application/octet-stream";
  const validated = validateUploadFile({ type: mimeType, size: file.size });
  if (!validated.success) {
    return { success: false, error: validated.error };
  }

  return {
    success: true,
    data: {
      file,
      sanitizedFilename: sanitizeFilename(file.name),
      mimeType,
    },
  };
}
