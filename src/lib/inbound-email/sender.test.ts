import { describe, expect, it } from "vitest";
import { extractSenderAddress } from "./sender";

describe("extractSenderAddress", () => {
  it("returns a plain address", () => {
    expect(extractSenderAddress("webtester@mail.grokbot.com")).toBe("webtester@mail.grokbot.com");
  });

  it("strips a display name", () => {
    expect(extractSenderAddress('"Web Tester" <WebTester@Mail.Grokbot.com>')).toBe(
      "webtester@mail.grokbot.com",
    );
    expect(extractSenderAddress("Web Tester <webtester@mail.grokbot.com>")).toBe(
      "webtester@mail.grokbot.com",
    );
  });

  it("takes the first address from a list", () => {
    expect(extractSenderAddress(["Bad", "a@b.com", "c@d.com"])).toBe("a@b.com");
  });

  it("returns null for missing or non-address values", () => {
    expect(extractSenderAddress(null)).toBeNull();
    expect(extractSenderAddress(undefined)).toBeNull();
    expect(extractSenderAddress("")).toBeNull();
    expect(extractSenderAddress("no address here")).toBeNull();
    expect(extractSenderAddress(42)).toBeNull();
  });
});
