import {
  AUTOMATION_AGENT_ID,
  AUTOMATION_AGENT_KIND,
  type AutomationAgentId,
  type AutomationAgentKind,
} from "@/constants/automation";

export type AutomationAgent = {
  id: AutomationAgentId;
  name: string;
  /** One action-oriented sentence, ~80-100 chars, like the reference directories. */
  description: string;
  kind: AutomationAgentKind;
  /**
   * simple-icons slug for the brand mark. Optional: the icon set has no
   * OpenAI/ChatGPT, Codex or OpenClaw mark, and redrawing one by hand is not
   * an option, so those cards fall back to a letter tile.
   */
  iconSlug?: string;
  /**
   * Official docs page for making an instruction persistent in this agent.
   * Optional on purpose: an agent whose docs page can't be verified ships
   * without a link rather than with a guessed one (verified in a later task).
   */
  docsUrl?: string;
};

export type AutomationAgentGroup = {
  kind: AutomationAgentKind;
  agents: AutomationAgent[];
};

export const AUTOMATION_AGENTS: readonly AutomationAgent[] = [
  {
    id: AUTOMATION_AGENT_ID.CLAUDE,
    name: "Claude",
    description: "Keep the rule in a project or in memory so it applies to every inbox check.",
    kind: AUTOMATION_AGENT_KIND.CHAT,
    iconSlug: "claude",
    docsUrl: "https://docs.claude.com/",
  },
  {
    id: AUTOMATION_AGENT_ID.CHATGPT,
    name: "ChatGPT",
    description: "Store the rule in Custom Instructions, or in the GPT that reads your mail.",
    kind: AUTOMATION_AGENT_KIND.CHAT,
    docsUrl: "https://help.openai.com/",
  },
  {
    id: AUTOMATION_AGENT_ID.GEMINI,
    name: "Gemini",
    description: "Save the rule as a standing instruction in Gemini or Gemini for Workspace.",
    kind: AUTOMATION_AGENT_KIND.CHAT,
    iconSlug: "googlegemini",
    docsUrl: "https://support.google.com/gemini",
  },
  {
    id: AUTOMATION_AGENT_ID.CURSOR,
    name: "Cursor",
    description: "Drop the rule into a rules file so the agent applies it in every session.",
    kind: AUTOMATION_AGENT_KIND.CODING,
    iconSlug: "cursor",
    docsUrl: "https://docs.cursor.com/",
  },
  {
    id: AUTOMATION_AGENT_ID.CODEX,
    name: "Codex",
    description: "Add the rule to your agent instructions file so it survives new runs.",
    kind: AUTOMATION_AGENT_KIND.CODING,
    docsUrl: "https://developers.openai.com/codex/",
  },
  {
    id: AUTOMATION_AGENT_ID.CLINE,
    name: "Cline",
    description: "Add the rule to your Cline rules so it survives new sessions.",
    kind: AUTOMATION_AGENT_KIND.CODING,
    iconSlug: "cline",
    docsUrl: "https://docs.cline.bot/",
  },
  {
    id: AUTOMATION_AGENT_ID.OPENCLAW,
    name: "OpenClaw",
    description: "Paste the rule into the agent's standing instructions.",
    kind: AUTOMATION_AGENT_KIND.CODING,
    docsUrl: "https://openclaw.ai/",
  },
  {
    id: AUTOMATION_AGENT_ID.OTHER,
    name: "Other agents",
    description: "Any agent that can read and forward mail works. Paste the same prompt.",
    kind: AUTOMATION_AGENT_KIND.GENERIC,
  },
];

export function findAutomationAgent(id: string): AutomationAgent | undefined {
  return AUTOMATION_AGENTS.find((agent) => agent.id === id);
}

/** Groups the registry for the grid, in declared kind order. */
export function groupAgentsByKind(
  agents: readonly AutomationAgent[],
): AutomationAgentGroup[] {
  return Object.values(AUTOMATION_AGENT_KIND)
    .map((kind) => ({
      kind,
      agents: agents.filter((agent) => agent.kind === kind),
    }))
    .filter((group) => group.agents.length > 0);
}
