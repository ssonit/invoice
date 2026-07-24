import { describe, expect, it } from "vitest";
import {
  parseForgotPasswordForm,
  parseLoginForm,
  parseResetPasswordForm,
  parseSignupForm,
} from "./auth";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value);
  }
  return fd;
}

describe("parseLoginForm", () => {
  it("accepts a valid email and non-empty password", () => {
    const result = parseLoginForm(formData({ email: "a@example.com", password: "x" }));
    expect(result).toEqual({ success: true, data: { email: "a@example.com", password: "x" } });
  });

  it("trims the email", () => {
    const result = parseLoginForm(formData({ email: "  a@example.com  ", password: "x" }));
    expect(result).toEqual({ success: true, data: { email: "a@example.com", password: "x" } });
  });

  it("rejects an invalid email", () => {
    const result = parseLoginForm(formData({ email: "not-an-email", password: "x" }));
    expect(result.success).toBe(false);
  });

  it("rejects an empty password", () => {
    const result = parseLoginForm(formData({ email: "a@example.com", password: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects a missing email field", () => {
    const result = parseLoginForm(formData({ password: "x" }));
    expect(result.success).toBe(false);
  });
});

describe("parseSignupForm", () => {
  it("accepts a valid email and a 6+ character password", () => {
    const result = parseSignupForm(formData({ email: "a@example.com", password: "abcdef" }));
    expect(result).toEqual({ success: true, data: { email: "a@example.com", password: "abcdef" } });
  });

  it("rejects a password shorter than 6 characters", () => {
    const result = parseSignupForm(formData({ email: "a@example.com", password: "abcde" }));
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = parseSignupForm(formData({ email: "not-an-email", password: "abcdef" }));
    expect(result.success).toBe(false);
  });
});

describe("parseForgotPasswordForm", () => {
  it("accepts a valid email", () => {
    const result = parseForgotPasswordForm(formData({ email: "a@example.com" }));
    expect(result).toEqual({ success: true, data: { email: "a@example.com" } });
  });

  it("trims the email", () => {
    const result = parseForgotPasswordForm(formData({ email: "  a@example.com  " }));
    expect(result).toEqual({ success: true, data: { email: "a@example.com" } });
  });

  it("rejects an invalid email", () => {
    expect(parseForgotPasswordForm(formData({ email: "not-an-email" })).success).toBe(
      false,
    );
  });

  it("rejects a missing email", () => {
    expect(parseForgotPasswordForm(formData({})).success).toBe(false);
  });
});

describe("parseResetPasswordForm", () => {
  it("accepts a password of 6+ characters", () => {
    const result = parseResetPasswordForm(formData({ password: "abcdef" }));
    expect(result).toEqual({ success: true, data: { password: "abcdef" } });
  });

  it("rejects a password shorter than 6 characters", () => {
    expect(parseResetPasswordForm(formData({ password: "abcde" })).success).toBe(false);
  });

  it("rejects a missing password", () => {
    expect(parseResetPasswordForm(formData({})).success).toBe(false);
  });
});
