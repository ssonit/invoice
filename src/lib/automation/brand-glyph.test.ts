import { describe, expect, it } from "vitest";
import { AUTOMATION_AGENTS } from "./agents";
import { resolveBrandGlyph } from "./brand-glyph";

describe("resolveBrandGlyph", () => {
  it("resolves a slug the icon set ships", () => {
    const glyph = resolveBrandGlyph("claude");
    expect(glyph).not.toBeNull();
    expect(glyph!.path.length).toBeGreaterThan(0);
    expect(glyph!.hex).toMatch(/^[0-9A-Fa-f]{6}$/);
  });

  it("resolves every slug the registry references", () => {
    for (const agent of AUTOMATION_AGENTS) {
      if (!agent.iconSlug) continue;
      expect(resolveBrandGlyph(agent.iconSlug), agent.name).not.toBeNull();
    }
  });

  it("returns null for a brand the set does not ship", () => {
    // Simple Icons carries no OpenAI mark, and hand-redrawing one is not an
    // option, so ChatGPT and Codex cards use a letter tile instead.
    expect(resolveBrandGlyph("openai")).toBeNull();
  });

  it("returns null for an empty slug", () => {
    expect(resolveBrandGlyph("")).toBeNull();
  });
});
