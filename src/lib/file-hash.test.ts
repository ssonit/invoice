import { describe, expect, it } from "vitest";
import { sha256Hex } from "./file-hash";

describe("sha256Hex", () => {
  it("returns a 64-character lowercase hex string", () => {
    expect(sha256Hex(Buffer.from("hello"))).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for identical input", () => {
    expect(sha256Hex(Buffer.from("hello"))).toBe(sha256Hex(Buffer.from("hello")));
  });

  it("differs for different input", () => {
    expect(sha256Hex(Buffer.from("hello"))).not.toBe(sha256Hex(Buffer.from("world")));
  });

  it("handles an empty buffer", () => {
    expect(sha256Hex(Buffer.alloc(0))).toMatch(/^[0-9a-f]{64}$/);
  });
});
