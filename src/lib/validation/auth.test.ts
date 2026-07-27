import { describe, expect, it } from "vitest";
import {
  parseForgotPasswordForm,
  parseLoginForm,
  parseResetPasswordForm,
  parseSignupForm,
} from "./auth";
import { EMAIL_MAX_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/constants/validation";

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

  it("rejects an overly long email", () => {
    const longEmail = `${"a".repeat(EMAIL_MAX_LENGTH)}@example.com`;
    const result = parseLoginForm(formData({ email: longEmail, password: "x" }));
    expect(result.success).toBe(false);
  });

  it("rejects an overly long password", () => {
    const result = parseLoginForm(
      formData({ email: "a@example.com", password: "x".repeat(PASSWORD_MAX_LENGTH + 1) }),
    );
    expect(result.success).toBe(false);
  });
});

describe("parseSignupForm", () => {
  it(`accepts a valid email and a ${PASSWORD_MIN_LENGTH}+ character password`, () => {
    const password = "a".repeat(PASSWORD_MIN_LENGTH);
    const result = parseSignupForm(formData({ email: "a@example.com", password }));
    expect(result).toEqual({ success: true, data: { email: "a@example.com", password } });
  });

  it(`rejects a password shorter than ${PASSWORD_MIN_LENGTH} characters`, () => {
    const password = "a".repeat(PASSWORD_MIN_LENGTH - 1);
    const result = parseSignupForm(formData({ email: "a@example.com", password }));
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = parseSignupForm(formData({ email: "not-an-email", password: "abcdef" }));
    expect(result.success).toBe(false);
  });

  it("rejects an overly long password", () => {
    const result = parseSignupForm(
      formData({ email: "a@example.com", password: "a".repeat(PASSWORD_MAX_LENGTH + 1) }),
    );
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
  it(`accepts a password of ${PASSWORD_MIN_LENGTH}+ characters`, () => {
    const password = "a".repeat(PASSWORD_MIN_LENGTH);
    const result = parseResetPasswordForm(formData({ password }));
    expect(result).toEqual({ success: true, data: { password } });
  });

  it(`rejects a password shorter than ${PASSWORD_MIN_LENGTH} characters`, () => {
    const password = "a".repeat(PASSWORD_MIN_LENGTH - 1);
    expect(parseResetPasswordForm(formData({ password })).success).toBe(false);
  });

  it("rejects a missing password", () => {
    expect(parseResetPasswordForm(formData({})).success).toBe(false);
  });

  it("rejects an overly long password", () => {
    expect(
      parseResetPasswordForm(formData({ password: "a".repeat(PASSWORD_MAX_LENGTH + 1) })).success,
    ).toBe(false);
  });
});
