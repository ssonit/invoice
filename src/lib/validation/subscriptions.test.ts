import { describe, expect, it } from "vitest";
import { parseConfirmSubscriptionInput, parseMarkSubscriptionInput } from "./subscriptions";

describe("parseConfirmSubscriptionInput", () => {
  it("accepts a valid active confirmation", () => {
    const result = parseConfirmSubscriptionInput({ vendorKey: "acme saas", status: "active" });
    expect(result).toEqual({ success: true, data: { vendorKey: "acme saas", status: "active" } });
  });

  it("accepts a valid cancelled confirmation", () => {
    const result = parseConfirmSubscriptionInput({ vendorKey: "acme saas", status: "cancelled" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty vendorKey", () => {
    const result = parseConfirmSubscriptionInput({ vendorKey: "", status: "active" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid status value", () => {
    const result = parseConfirmSubscriptionInput({ vendorKey: "acme saas", status: "paused" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing vendorKey", () => {
    const result = parseConfirmSubscriptionInput({ status: "active" });
    expect(result.success).toBe(false);
  });
});

describe("parseMarkSubscriptionInput", () => {
  it("accepts a valid vendorKey and monthly cycle", () => {
    const result = parseMarkSubscriptionInput({ vendorKey: "acme", cycle: "monthly" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.vendorKey).toBe("acme");
      expect(result.data.cycle).toBe("monthly");
    }
  });

  it("accepts yearly cycle", () => {
    const result = parseMarkSubscriptionInput({ vendorKey: "acme", cycle: "yearly" });
    expect(result.success).toBe(true);
  });

  it("rejects missing vendorKey", () => {
    const result = parseMarkSubscriptionInput({ cycle: "monthly" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid cycle", () => {
    const result = parseMarkSubscriptionInput({ vendorKey: "acme", cycle: "weekly" });
    expect(result.success).toBe(false);
  });

  it("rejects empty vendorKey", () => {
    const result = parseMarkSubscriptionInput({ vendorKey: "", cycle: "monthly" });
    expect(result.success).toBe(false);
  });
});
