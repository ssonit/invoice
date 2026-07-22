import { describe, expect, it } from "vitest";
import { parseConfirmSubscriptionInput } from "./subscriptions";

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
