// Shared constraints for invoice file uploads (manual upload route today;
// reusable if a client-side dropzone check is added later).

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB

export const ALLOWED_UPLOAD_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export type AllowedUploadMimeType = (typeof ALLOWED_UPLOAD_MIME_TYPES)[number];

export type UploadValidationResult =
  | { success: true }
  | { success: false; error: string };

export function validateUploadFile(file: { type: string; size: number }): UploadValidationResult {
  if (file.size <= 0) {
    return { success: false, error: "The file is empty" };
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    const maxMb = MAX_UPLOAD_BYTES / (1024 * 1024);
    return { success: false, error: `File is too large — max ${maxMb}MB` };
  }

  if (!ALLOWED_UPLOAD_MIME_TYPES.includes(file.type as AllowedUploadMimeType)) {
    return {
      success: false,
      error:
        "Unsupported file type — upload an invoice/receipt as PDF or image (PNG/JPEG/WEBP/GIF)",
    };
  }

  return { success: true };
}
