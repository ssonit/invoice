export const AUTOMATION_AGENT_ID = {
  CLAUDE: "claude",
  OPENCLAW: "openclaw",
  CHATGPT: "chatgpt",
  GEMINI: "gemini",
  CURSOR: "cursor",
  CODEX: "codex",
  CLINE: "cline",
  OTHER: "other",
} as const;

export type AutomationAgentId =
  (typeof AUTOMATION_AGENT_ID)[keyof typeof AUTOMATION_AGENT_ID];

// Grid grouping, in render order — mirrors how integration directories group
// entries instead of running one flat list of tiles.
export const AUTOMATION_AGENT_KIND = {
  CHAT: "chat",
  CODING: "coding",
  GENERIC: "generic",
} as const;

export type AutomationAgentKind =
  (typeof AUTOMATION_AGENT_KIND)[keyof typeof AUTOMATION_AGENT_KIND];

export const AUTOMATION_KIND_LABEL: Record<AutomationAgentKind, string> = {
  [AUTOMATION_AGENT_KIND.CHAT]: "Chat agents",
  [AUTOMATION_AGENT_KIND.CODING]: "Coding agents",
  [AUTOMATION_AGENT_KIND.GENERIC]: "Anything else",
};

export const AUTOMATION_STATUS = {
  WAITING_LABEL: "Waiting for your first forwarded email",
  CONNECTED_LABEL: "Connected",
} as const;

export const AUTOMATION_SETUP_STEPS: ReadonlyArray<{ title: string; body: string }> = [
  {
    title: "Copy the prompt",
    body: "Pick the agent that reads your email and copy its setup prompt.",
  },
  {
    title: "Paste it into your agent",
    body: "Store it where the agent keeps standing instructions, not in a one-off chat.",
  },
  {
    title: "Forward one invoice",
    body: "The first email that arrives flips this page to connected.",
  },
];
