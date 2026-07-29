import { describe, expect, it } from "vitest";
import { AUTOMATION_AGENT_ID, AUTOMATION_AGENT_KIND } from "@/constants/automation";
import {
  AUTOMATION_AGENTS,
  findAutomationAgent,
  groupAgentsByKind,
} from "./agents";

describe("AUTOMATION_AGENTS", () => {
  it("covers every declared agent id exactly once", () => {
    const ids = AUTOMATION_AGENTS.map((agent) => agent.id);
    expect([...ids].sort()).toEqual(Object.values(AUTOMATION_AGENT_ID).sort());
  });

  it("gives every agent a name and a description", () => {
    for (const agent of AUTOMATION_AGENTS) {
      expect(agent.name.trim().length).toBeGreaterThan(0);
      expect(agent.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("keeps descriptions to one short sentence", () => {
    // The reference directories (Linear, Vercel) run ~80-100 characters.
    for (const agent of AUTOMATION_AGENTS) {
      expect(agent.description.length).toBeLessThanOrEqual(110);
    }
  });

  it("only ever links out over https", () => {
    for (const agent of AUTOMATION_AGENTS) {
      if (!agent.docsUrl) continue;
      expect(agent.docsUrl.startsWith("https://")).toBe(true);
    }
  });

  it("gives every agent a known kind", () => {
    const kinds = Object.values(AUTOMATION_AGENT_KIND);
    for (const agent of AUTOMATION_AGENTS) {
      expect(kinds).toContain(agent.kind);
    }
  });

  it("has no install link for the generic catch-all agent", () => {
    expect(findAutomationAgent(AUTOMATION_AGENT_ID.OTHER)?.docsUrl).toBeUndefined();
  });
});

describe("groupAgentsByKind", () => {
  it("returns groups in declared kind order, each non-empty", () => {
    const groups = groupAgentsByKind(AUTOMATION_AGENTS);
    expect(groups.map((group) => group.kind)).toEqual(
      Object.values(AUTOMATION_AGENT_KIND),
    );
    for (const group of groups) {
      expect(group.agents.length).toBeGreaterThan(0);
    }
  });

  it("keeps every agent, losing none", () => {
    const grouped = groupAgentsByKind(AUTOMATION_AGENTS).flatMap((g) => g.agents);
    expect(grouped).toHaveLength(AUTOMATION_AGENTS.length);
  });
});

describe("findAutomationAgent", () => {
  it("finds an agent by id", () => {
    expect(findAutomationAgent(AUTOMATION_AGENT_ID.CLAUDE)?.name).toBe("Claude");
  });

  it("returns undefined for an unknown id", () => {
    expect(findAutomationAgent("not-an-agent")).toBeUndefined();
  });
});
