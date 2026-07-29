import { describe, expect, it } from "vitest";
import { buildForwardPrompt } from "./prompt";

const address = "invoice_ab12cd@agentmail.to";

describe("buildForwardPrompt", () => {
  it("embeds the forwarding address exactly once", () => {
    expect(buildForwardPrompt(address).split(address)).toHaveLength(2);
  });

  it("keeps all five forwarding rules", () => {
    const prompt = buildForwardPrompt(address);
    expect(prompt).toContain("- Preserve subject");
    expect(prompt).toContain("- Keep all attachments");
    expect(prompt).toContain("- Do not modify the email body");
    expect(prompt).toContain("- Ignore newsletters and marketing emails");
    expect(prompt).toContain("- If uncertain, do not forward");
  });

  it("names the document kinds that should be forwarded", () => {
    const prompt = buildForwardPrompt(address);
    expect(prompt).toContain("invoice");
    expect(prompt).toContain("receipt");
    expect(prompt).toContain("attachment");
  });

  it("leaves no unsubstituted placeholder", () => {
    expect(buildForwardPrompt(address)).not.toMatch(/\{\{|\}\}|<address>|xxxxx/i);
  });

  it("returns the same text for the same address", () => {
    expect(buildForwardPrompt(address)).toBe(buildForwardPrompt(address));
  });

  it("trims surrounding whitespace on the address", () => {
    expect(buildForwardPrompt(`  ${address}  `)).toBe(buildForwardPrompt(address));
  });

  it("throws when the address is empty or whitespace only", () => {
    expect(() => buildForwardPrompt("")).toThrow(/forwarding address/i);
    expect(() => buildForwardPrompt("   ")).toThrow(/forwarding address/i);
  });
});
