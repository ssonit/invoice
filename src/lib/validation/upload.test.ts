import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, validateUploadFile } from "./upload";

describe("validateUploadFile", () => {
  it("accepts a PDF within the size limit", () => {
    const result = validateUploadFile({ type: "application/pdf", size: 1024 });
    expect(result).toEqual({ success: true });
  });

  it("accepts each allowed image type", () => {
    for (const type of ["image/png", "image/jpeg", "image/webp", "image/gif"]) {
      expect(validateUploadFile({ type, size: 1024 })).toEqual({ success: true });
    }
  });

  it("rejects an empty file", () => {
    const result = validateUploadFile({ type: "application/pdf", size: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects a file over the size limit", () => {
    const result = validateUploadFile({ type: "application/pdf", size: MAX_UPLOAD_BYTES + 1 });
    expect(result.success).toBe(false);
  });

  it("accepts a file exactly at the size limit", () => {
    const result = validateUploadFile({ type: "application/pdf", size: MAX_UPLOAD_BYTES });
    expect(result).toEqual({ success: true });
  });

  it("rejects an unsupported mime type", () => {
    const result = validateUploadFile({ type: "text/plain", size: 1024 });
    expect(result.success).toBe(false);
  });
});
