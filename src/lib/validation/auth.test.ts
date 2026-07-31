import { describe, expect, it } from "vitest";
import {
  parseForgotPasswordForm,
  parseLoginForm,
  parseResetPasswordForm,
  parseSignupForm,
} from "./auth";
import { EMAIL_MAX_LENGTH, NAME_MAX_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/constants/validation";

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

function validSignupFields(overrides?: Record<string, string>): Record<string, string> {
  return {
    name: "Alex",
    email: "a@example.com",
    password: "a".repeat(PASSWORD_MIN_LENGTH),
    confirmPassword: "a".repeat(PASSWORD_MIN_LENGTH),
    ...overrides,
  };
}

describe("parseSignupForm", () => {
  it("accepts valid name, email, and matching passwords", () => {
    const fields = validSignupFields();
    const result = parseSignupForm(formData(fields));
    expect(result).toEqual({ success: true, data: fields });
  });

  it("trims the name", () => {
    const result = parseSignupForm(formData(validSignupFields({ name: "  Alex  " })));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("Alex");
  });

  it("rejects an empty name", () => {
    const result = parseSignupForm(formData(validSignupFields({ name: "" })));
    expect(result.success).toBe(false);
  });

  it("rejects a missing name field", () => {
    const { name, ...rest } = validSignupFields();
    void name;
    const result = parseSignupForm(formData(rest));
    expect(result.success).toBe(false);
  });

  it("rejects an overly long name", () => {
    const result = parseSignupForm(
      formData(validSignupFields({ name: "a".repeat(NAME_MAX_LENGTH + 1) })),
    );
    expect(result.success).toBe(false);
  });

  it("rejects when passwords do not match", () => {
    const result = parseSignupForm(
      formData(
        validSignupFields({
          password: "abcdefgh",
          confirmPassword: "different",
        }),
      ),
    );
    expect(result.success).toBe(false);
  });

  it("rejects an empty confirm password", () => {
    const result = parseSignupForm(formData(validSignupFields({ confirmPassword: "" })));
    expect(result.success).toBe(false);
  });

  it(`rejects a password shorter than ${PASSWORD_MIN_LENGTH} characters`, () => {
    const password = "a".repeat(PASSWORD_MIN_LENGTH - 1);
    const result = parseSignupForm(
      formData(validSignupFields({ password, confirmPassword: password })),
    );
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = parseSignupForm(formData(validSignupFields({ email: "not-an-email" })));
    expect(result.success).toBe(false);
  });

  it("rejects an overly long password", () => {
    const password = "a".repeat(PASSWORD_MAX_LENGTH + 1);
    const result = parseSignupForm(
      formData(
        validSignupFields({
          password,
          confirmPassword: password,
        }),
      ),
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
