import { describe, expect, it } from "vitest";
import {
  checkContentLength,
  isSafeRelativePath,
  parseSafeRedirectPath,
  parseUploadForm,
  parseVendorKeyInput,
  sanitizeFilename,
} from "./common";
import { MAX_UPLOAD_REQUEST_BYTES } from "@/constants/validation";

describe("isSafeRelativePath", () => {
  it("accepts a normal in-app path", () => {
    expect(isSafeRelativePath("/dashboard")).toBe(true);
    expect(isSafeRelativePath("/reset-password")).toBe(true);
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(isSafeRelativePath("//evil.com")).toBe(false);
    expect(isSafeRelativePath("https://evil.com")).toBe(false);
    expect(isSafeRelativePath("dashboard")).toBe(false);
  });
});

describe("parseSafeRedirectPath", () => {
  it("returns the path when safe", () => {
    expect(parseSafeRedirectPath("/reset-password", "/dashboard")).toBe("/reset-password");
  });

  it("falls back for unsafe paths", () => {
    expect(parseSafeRedirectPath("//evil.com", "/dashboard")).toBe("/dashboard");
    expect(parseSafeRedirectPath(null, "/dashboard")).toBe("/dashboard");
  });
});

describe("checkContentLength", () => {
  it("accepts when Content-Length is within the limit", () => {
    const request = new Request("http://localhost", {
      headers: { "content-length": "1024" },
    });
    expect(checkContentLength(request, MAX_UPLOAD_REQUEST_BYTES)).toEqual({
      success: true,
      data: null,
    });
  });

  it("rejects when Content-Length exceeds the limit", () => {
    const request = new Request("http://localhost", {
      headers: { "content-length": String(MAX_UPLOAD_REQUEST_BYTES + 1) },
    });
    const result = checkContentLength(request, MAX_UPLOAD_REQUEST_BYTES);
    expect(result.success).toBe(false);
  });

  it("rejects a malformed Content-Length", () => {
    const request = new Request("http://localhost", {
      headers: { "content-length": "not-a-number" },
    });
    expect(checkContentLength(request, 100).success).toBe(false);
  });
});

describe("sanitizeFilename", () => {
  it("strips directory components and control characters", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("folder\\invoice.pdf")).toBe("invoice.pdf");
  });

  it("falls back when the name is empty after cleaning", () => {
    expect(sanitizeFilename("   ")).toBe("upload");
  });
});

describe("parseVendorKeyInput", () => {
  it("accepts a non-empty key", () => {
    expect(parseVendorKeyInput("acme saas")).toEqual({
      success: true,
      data: { vendorKey: "acme saas" },
    });
  });

  it("rejects an empty key", () => {
    expect(parseVendorKeyInput("").success).toBe(false);
  });
});

describe("parseUploadForm", () => {
  it("accepts a valid single file field", () => {
    const fd = new FormData();
    fd.set("file", new File([new Uint8Array([1])], "invoice.pdf", { type: "application/pdf" }));
    const result = parseUploadForm(fd);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sanitizedFilename).toBe("invoice.pdf");
      expect(result.data.mimeType).toBe("application/pdf");
    }
  });

  it("rejects extra form fields", () => {
    const fd = new FormData();
    fd.set("file", new File([new Uint8Array([1])], "a.pdf", { type: "application/pdf" }));
    fd.set("extra", "surprise");
    expect(parseUploadForm(fd).success).toBe(false);
  });

  it("rejects a missing file", () => {
    expect(parseUploadForm(new FormData()).success).toBe(false);
  });
});
