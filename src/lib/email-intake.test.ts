import { describe, expect, it } from "vitest";
import { isEmailIntakeConfigured, missingEmailIntakeKeys } from "./email-intake";

const full = {
  AGENTMAIL_API_KEY: "am-key",
  AGENTMAIL_WEBHOOK_SECRET: "whsec",
  TRIGGER_SECRET_KEY: "tr-key",
};

describe("isEmailIntakeConfigured", () => {
  it("is true when all three keys are set", () => {
    expect(isEmailIntakeConfigured(full)).toBe(true);
  });

  it("is false when nothing is set", () => {
    expect(isEmailIntakeConfigured({})).toBe(false);
  });

  it("is false when any one key is missing", () => {
    expect(isEmailIntakeConfigured({ ...full, TRIGGER_SECRET_KEY: undefined })).toBe(false);
    expect(isEmailIntakeConfigured({ ...full, AGENTMAIL_API_KEY: undefined })).toBe(false);
    expect(isEmailIntakeConfigured({ ...full, AGENTMAIL_WEBHOOK_SECRET: undefined })).toBe(false);
  });

  it("treats empty and whitespace-only values as unset", () => {
    expect(isEmailIntakeConfigured({ ...full, AGENTMAIL_API_KEY: "" })).toBe(false);
    expect(isEmailIntakeConfigured({ ...full, AGENTMAIL_API_KEY: "   " })).toBe(false);
  });
});

describe("missingEmailIntakeKeys", () => {
  it("lists nothing when fully configured", () => {
    expect(missingEmailIntakeKeys(full)).toEqual([]);
  });

  it("lists every missing key in declared order", () => {
    expect(missingEmailIntakeKeys({ AGENTMAIL_WEBHOOK_SECRET: "x" })).toEqual([
      "AGENTMAIL_API_KEY",
      "TRIGGER_SECRET_KEY",
    ]);
  });
});
