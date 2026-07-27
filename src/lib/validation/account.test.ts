import { describe, expect, it } from "vitest";
import { parseDeleteAccountInput } from "./account";
import { EMAIL_MAX_LENGTH } from "@/constants/validation";

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
