import { describe, expect, it } from "vitest";
import {
  parseCreateVendorInput,
  parseDeleteVendorInput,
  parseUpdateVendorInput,
} from "./vendors";

describe("parseCreateVendorInput", () => {
  it("accepts a valid name with no notes", () => {
    const result = parseCreateVendorInput({ name: "Acme SaaS" });
    expect(result).toEqual({ success: true, data: { name: "Acme SaaS", notes: null } });
  });

  it("trims the name and keeps trimmed notes", () => {
    const result = parseCreateVendorInput({ name: "  Acme  ", notes: "  hello  " });
    expect(result).toEqual({ success: true, data: { name: "Acme", notes: "hello" } });
  });

  it("converts empty-after-trim notes to null", () => {
    const result = parseCreateVendorInput({ name: "Acme", notes: "   " });
    expect(result).toEqual({ success: true, data: { name: "Acme", notes: null } });
  });

  it("rejects an empty name", () => {
    expect(parseCreateVendorInput({ name: "" }).success).toBe(false);
  });

  it("rejects a name over 200 characters", () => {
    expect(parseCreateVendorInput({ name: "a".repeat(201) }).success).toBe(false);
  });

  it("rejects notes over 1000 characters", () => {
    expect(
      parseCreateVendorInput({ name: "Acme", notes: "a".repeat(1001) }).success,
    ).toBe(false);
  });
});

describe("parseUpdateVendorInput", () => {
  const validId = "123e4567-e89b-12d3-a456-426614174000";

  it("accepts a valid id + name", () => {
    const result = parseUpdateVendorInput({ id: validId, name: "Acme" });
    expect(result.success).toBe(true);
  });

  it("rejects a non-uuid id", () => {
    expect(parseUpdateVendorInput({ id: "not-a-uuid", name: "Acme" }).success).toBe(
      false,
    );
  });

  it("rejects an empty name", () => {
    expect(parseUpdateVendorInput({ id: validId, name: "" }).success).toBe(false);
  });
});

describe("parseDeleteVendorInput", () => {
  const validId = "123e4567-e89b-12d3-a456-426614174000";

  it("accepts a valid uuid", () => {
    expect(parseDeleteVendorInput({ id: validId })).toEqual({
      success: true,
      data: { id: validId },
    });
  });

  it("rejects a missing id", () => {
    expect(parseDeleteVendorInput({}).success).toBe(false);
  });

  it("rejects a non-uuid id", () => {
    expect(parseDeleteVendorInput({ id: "123" }).success).toBe(false);
  });
});
