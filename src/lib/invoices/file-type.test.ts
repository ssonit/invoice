import { describe, expect, it } from "vitest";
import { mimeTypeFromPath } from "./file-type";

describe("mimeTypeFromPath", () => {
  it("maps supported extensions case-insensitively", () => {
    expect(mimeTypeFromPath("u/upload-1-Bill.PDF")).toBe("application/pdf");
    expect(mimeTypeFromPath("u/a.jpeg")).toBe("image/jpeg");
    expect(mimeTypeFromPath("u/a.png")).toBe("image/png");
  });

  it("returns null for unsupported or missing extensions", () => {
    expect(mimeTypeFromPath("u/notes.txt")).toBeNull();
    expect(mimeTypeFromPath("u/noextension")).toBeNull();
  });
});
