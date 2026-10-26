import { describe, expect, it } from "vitest";
import { parseDeleteAccountInput, parseDisplayNameForm } from "./account";
import { EMAIL_MAX_LENGTH, NAME_MAX_LENGTH } from "@/constants/validation";

describe("parseDeleteAccountInput", () => {
  it("accepts a valid email", () => {
    const result = parseDeleteAccountInput({ confirmEmail: "a@example.com" });
    expect(result).toEqual({ success: true, data: { confirmEmail: "a@example.com" } });
  });

  it("trims the email", () => {
    const result = parseDeleteAccountInput({ confirmEmail: "  a@example.com  " });
    expect(result).toEqual({ success: true, data: { confirmEmail: "a@example.com" } });
  });

  it("rejects an invalid email", () => {
    expect(parseDeleteAccountInput({ confirmEmail: "not-an-email" }).success).toBe(false);
  });

  it("rejects an overly long email", () => {
    const longEmail = `${"a".repeat(EMAIL_MAX_LENGTH)}@example.com`;
    expect(parseDeleteAccountInput({ confirmEmail: longEmail }).success).toBe(false);
  });
});

function nameForm(value: string): FormData {
  const formData = new FormData();
  formData.set("name", value);
  return formData;
}

describe("parseDisplayNameForm", () => {
  it("trims the name", () => {
    expect(parseDisplayNameForm(nameForm("  Sơn  "))).toEqual({
      success: true,
      data: { name: "Sơn" },
    });
  });

  it("rejects a blank name", () => {
    expect(parseDisplayNameForm(nameForm("   "))).toEqual({
      success: false,
      error: "Name is required",
    });
  });

  it("rejects a missing field", () => {
    expect(parseDisplayNameForm(new FormData()).success).toBe(false);
  });

  it("rejects an over-long name and accepts the boundary", () => {
    expect(parseDisplayNameForm(nameForm("x".repeat(NAME_MAX_LENGTH))).success).toBe(true);
    expect(parseDisplayNameForm(nameForm("x".repeat(NAME_MAX_LENGTH + 1))).success).toBe(false);
  });
});
