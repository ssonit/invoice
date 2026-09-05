import { describe, expect, it } from "vitest";
import { splitFilesByQuota } from "./upload-batch";

describe("splitFilesByQuota", () => {
  it("uploads everything when quota is unlimited", () => {
    const result = splitFilesByQuota(["a", "b", "c"], { unlimited: true });
    expect(result).toEqual({ toUpload: ["a", "b", "c"], skipped: [] });
  });

  it("caps the batch to the remaining slots", () => {
    const result = splitFilesByQuota(["a", "b", "c"], { unlimited: false, used: 8, limit: 10 });
    expect(result).toEqual({ toUpload: ["a", "b"], skipped: ["c"] });
  });

  it("skips everything when already at the limit", () => {
    const result = splitFilesByQuota(["a", "b"], { unlimited: false, used: 10, limit: 10 });
    expect(result).toEqual({ toUpload: [], skipped: ["a", "b"] });
  });

  it("skips everything when already over the limit", () => {
    const result = splitFilesByQuota(["a", "b"], { unlimited: false, used: 15, limit: 10 });
    expect(result).toEqual({ toUpload: [], skipped: ["a", "b"] });
  });

  it("uploads everything when remaining slots exceed the batch size", () => {
    const result = splitFilesByQuota(["a"], { unlimited: false, used: 0, limit: 10 });
    expect(result).toEqual({ toUpload: ["a"], skipped: [] });
  });

  it("handles an empty batch", () => {
    const result = splitFilesByQuota([], { unlimited: false, used: 0, limit: 10 });
    expect(result).toEqual({ toUpload: [], skipped: [] });
  });
});
