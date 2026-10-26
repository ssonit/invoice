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

export const AUTOMATION_AGENT_KIND_OPTIONS: ReadonlyArray<{
  value: AutomationAgentKind;
  label: string;
}> = [
  { value: AUTOMATION_AGENT_KIND.CHAT, label: "Chat agents" },
  { value: AUTOMATION_AGENT_KIND.CODING, label: "Coding agents" },
  { value: AUTOMATION_AGENT_KIND.GENERIC, label: "Anything else" },
];

// Derived from the options array above — don't hand-maintain a second mapping
// that can drift out of sync with it.
export const AUTOMATION_KIND_LABEL: Record<AutomationAgentKind, string> = Object.fromEntries(
  AUTOMATION_AGENT_KIND_OPTIONS.map((o) => [o.value, o.label]),
) as Record<AutomationAgentKind, string>;
