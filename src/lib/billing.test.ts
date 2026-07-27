import { describe, expect, it } from "vitest";
import { hasActiveTeamPlan } from "./billing";

describe("hasActiveTeamPlan", () => {
  it("returns false for no subscription row", () => {
    expect(hasActiveTeamPlan(null)).toBe(false);
  });

  it("returns false for status 'none'", () => {
    expect(hasActiveTeamPlan({ status: "none", ends_at: null })).toBe(false);
  });

  it.each(["active", "on_trial", "past_due"] as const)(
    "returns true for status '%s'",
    (status) => {
      expect(hasActiveTeamPlan({ status, ends_at: null })).toBe(true);
    },
  );

  it("returns true when cancelled but ends_at is in the future", () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
    expect(hasActiveTeamPlan({ status: "cancelled", ends_at: future })).toBe(true);
  });

  it("returns false when cancelled and ends_at is in the past", () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();
    expect(hasActiveTeamPlan({ status: "cancelled", ends_at: past })).toBe(false);
  });

  it("returns false when cancelled with no ends_at", () => {
    expect(hasActiveTeamPlan({ status: "cancelled", ends_at: null })).toBe(false);
  });

  it.each(["paused", "unpaid", "expired"] as const)(
    "returns false for status '%s'",
    (status) => {
      expect(hasActiveTeamPlan({ status, ends_at: null })).toBe(false);
    },
  );
});
