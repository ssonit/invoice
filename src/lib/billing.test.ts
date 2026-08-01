import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getBillingMode, hasActiveTeamPlan, isBillingDevUnlockEnabled } from "./billing";

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

describe("isBillingDevUnlockEnabled", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns true when BILLING_DEV_UNLOCK=true in non-prod", () => {
    vi.stubEnv("BILLING_DEV_UNLOCK", "true");
    vi.stubEnv("NODE_ENV", "development");
    expect(isBillingDevUnlockEnabled()).toBe(true);
  });

  it("returns false when BILLING_DEV_UNLOCK is not set", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(isBillingDevUnlockEnabled()).toBe(false);
  });

  it("returns false when BILLING_DEV_UNLOCK is not exactly 'true'", () => {
    vi.stubEnv("BILLING_DEV_UNLOCK", "1");
    vi.stubEnv("NODE_ENV", "development");
    expect(isBillingDevUnlockEnabled()).toBe(false);
  });

  it("returns false when VERCEL_ENV is production", () => {
    vi.stubEnv("BILLING_DEV_UNLOCK", "true");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NODE_ENV", "development");
    expect(isBillingDevUnlockEnabled()).toBe(false);
  });

  it("returns false when NODE_ENV is production", () => {
    vi.stubEnv("BILLING_DEV_UNLOCK", "true");
    vi.stubEnv("NODE_ENV", "production");
    expect(isBillingDevUnlockEnabled()).toBe(false);
  });

  it("returns false on production with both guards set", () => {
    vi.stubEnv("BILLING_DEV_UNLOCK", "true");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NODE_ENV", "production");
    expect(isBillingDevUnlockEnabled()).toBe(false);
  });
});

describe("getBillingMode", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 'live' when BILLING_MODE is not set", () => {
    expect(getBillingMode()).toBe("live");
  });

  it("returns 'none' when BILLING_MODE=none", () => {
    vi.stubEnv("BILLING_MODE", "none");
    expect(getBillingMode()).toBe("none");
  });

  it("returns 'test' when BILLING_MODE=test", () => {
    vi.stubEnv("BILLING_MODE", "test");
    expect(getBillingMode()).toBe("test");
  });

  it("returns 'live' when BILLING_MODE=live", () => {
    vi.stubEnv("BILLING_MODE", "live");
    expect(getBillingMode()).toBe("live");
  });

  it("returns 'live' when BILLING_MODE is an unrecognized value", () => {
    vi.stubEnv("BILLING_MODE", "garbage");
    expect(getBillingMode()).toBe("live");
  });
});
