# Automation Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/dashboard/automation` - a page that hands the user their forwarding address, a ready-to-paste prompt for eight AI agents, and a workspace-level "is this working yet?" status.

**Architecture:** Server Component reads the user's inbox row and a count of email-sourced invoices, then renders pure presentational components. The agent registry and prompt builder are pure functions in `src/lib/automation/` (unit-tested with Vitest); the only client components are copy buttons and the existing inbox-creation button. No new API route, no new table, no migration.

**Tech Stack:** Next.js 16 App Router (React 19 Server Components), Supabase JS, Tailwind v4 + shadcn-style UI in `src/components/ui/`, sonner toasts, Vitest.

**Spec:** [`docs/superpowers/specs/2026-07-29-automation-page-design.md`](../specs/2026-07-29-automation-page-design.md)

**Layout references:** grouped card sections and one-sentence action copy from the
[Linear integrations directory](https://linear.app/integrations); single-description,
single-target cards from [Vercel Marketplace](https://vercel.com/marketplace); one
verb-first primary action per card from
[Cursor's MCP install links](https://cursor.com/docs/context/mcp/install-links); the
intake address shown once with a status pill from
[Linear email intake](https://linear.app/integrations/create-issues-via-email). Visual
style stays inside [`docs/DESIGN-SYSTEM.md`](../../DESIGN-SYSTEM.md) tokens
(`rounded-[14px]`, `shadow-none`, 11/12/13px type, 150ms transitions, no gradients).

---

## File Structure

| File | Created / Modified | Responsibility |
| --- | --- | --- |
| `src/constants/automation.ts` | Create | Agent ids, kinds, group labels, status labels - no bare literals repeated across files |
| `src/lib/automation/agents.ts` | Create | `AutomationAgent` type, `AUTOMATION_AGENTS` registry, `findAutomationAgent()`, `groupAgentsByKind()` |
| `src/lib/automation/agents.test.ts` | Create | Registry invariants + grouping |
| `src/lib/automation/prompt.ts` | Create | `buildForwardPrompt(forwardAddress)` |
| `src/lib/automation/prompt.test.ts` | Create | Prompt content + failure mode |
| `src/lib/automation/brand-glyph.ts` | Create | `resolveBrandGlyph(slug)` over `simple-icons`, `null` when absent |
| `src/lib/automation/brand-glyph.test.ts` | Create | Known slug resolves, unknown slug returns null |
| `src/lib/nav-config.ts` | Modify | Add the Automation nav item |
| `src/lib/nav-config.test.ts` | Modify | Cover the new item |
| `src/components/dashboard/copy-button.tsx` | Create | Reusable copy-to-clipboard button (generalizes `copy-email-button.tsx`) |
| `src/components/dashboard/create-inbox-button.tsx` | Create (moved) | Inbox provisioning button, now shared by Settings and Automation |
| `src/app/dashboard/copy-email-button.tsx` | Delete | Superseded by `copy-button.tsx` |
| `src/app/dashboard/settings/create-inbox-button.tsx` | Delete | Moved to `src/components/dashboard/` |
| `src/app/dashboard/settings/page.tsx` | Modify | Use the two moved/renamed components |
| `src/app/dashboard/actions.ts` | Modify | `createInbox()` also revalidates `/dashboard/automation` |
| `src/components/dashboard/automation/connection-panel.tsx` | Create | Address + copy + status pill (shown once), or the create-address CTA |
| `src/components/dashboard/automation/setup-steps.tsx` | Create | Three verb-first steps: copy, paste, forward |
| `src/components/dashboard/automation/brand-glyph.tsx` | Create | Brand mark when one exists, letter tile otherwise |
| `src/components/dashboard/automation/agent-card.tsx` | Create | One agent: mark, name, one-line description, one *Copy prompt* action, quiet setup link |
| `src/components/dashboard/automation/agent-grid.tsx` | Create | Groups cards by kind into labelled sections |
| `src/components/dashboard/automation/automation-view.tsx` | Create | Page layout - props only, no queries |
| `src/app/dashboard/automation/page.tsx` | Create | Server Component: auth guard + two queries + render |
| `docs/automation.md` | Create | Feature record (how it works, what it deliberately doesn't do) |

---

## Task 1: Agent registry

**Files:**
- Create: `src/constants/automation.ts`
- Create: `src/lib/automation/agents.ts`
- Test: `src/lib/automation/agents.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/automation/agents.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/automation/agents.test.ts`
Expected: FAIL - `Failed to resolve import "@/constants/automation"`.

- [ ] **Step 3: Write the constants**

`src/constants/automation.ts`:

```ts
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

// Grid grouping, in render order - mirrors how integration directories group
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
```

- [ ] **Step 4: Write the registry**

`src/lib/automation/agents.ts`:

```ts
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
   * without a link rather than with a guessed one (see Task 9).
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/automation/agents.test.ts`
Expected: PASS - 10 tests.

- [ ] **Step 6: Commit**

```bash
git add src/constants/automation.ts src/lib/automation/agents.ts src/lib/automation/agents.test.ts
git commit -m "feat: add automation agent registry"
```

---

## Task 2: Forward prompt builder

**Files:**
- Create: `src/lib/automation/prompt.ts`
- Test: `src/lib/automation/prompt.test.ts`

The template is identical for every agent (agents differ in *where* you paste it), so the
function takes only the address.

- [ ] **Step 1: Write the failing test**

`src/lib/automation/prompt.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/automation/prompt.test.ts`
Expected: FAIL - `Failed to resolve import "./prompt"`.

- [ ] **Step 3: Write the implementation**

`src/lib/automation/prompt.ts`:

```ts
/**
 * The instruction a user pastes into their own AI agent so it forwards only
 * invoice mail to their workspace address. One template for every agent -
 * agents differ in where you paste it, not in what it says.
 */
export function buildForwardPrompt(forwardAddress: string): string {
  const address = forwardAddress.trim();
  // Callers only render a prompt once an inbox exists, so an empty address is
  // a programming error, not an anticipated outcome - throw rather than
  // return a prompt that would silently forward nowhere.
  if (!address) {
    throw new Error("buildForwardPrompt requires a non-empty forwarding address");
  }

  return `Whenever you receive an invoice, tax invoice, receipt, supplier invoice or accounting document with a PDF or image attachment, automatically forward the original email to:

${address}

Rules:
- Preserve subject
- Keep all attachments
- Do not modify the email body
- Ignore newsletters and marketing emails
- If uncertain, do not forward`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/automation/prompt.test.ts`
Expected: PASS - 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/automation/prompt.ts src/lib/automation/prompt.test.ts
git commit -m "feat: add agent forwarding prompt builder"
```

---

## Task 3: Brand glyph resolution

Integration directories show real brand marks. `simple-icons` ships them as SVG path data,
so nothing is fetched from a CDN at runtime. The set has no OpenAI/ChatGPT, Codex or
OpenClaw mark, so this function returns `null` for those and the card falls back to a
letter tile.

**Files:**
- Modify: `package.json` (add `simple-icons`)
- Create: `src/lib/automation/brand-glyph.ts`
- Test: `src/lib/automation/brand-glyph.test.ts`

- [ ] **Step 1: Install the icon set**

```bash
npm install simple-icons
```

Expected: `simple-icons` appears in `dependencies` (16.27.1 or newer).

- [ ] **Step 2: Write the failing test**

`src/lib/automation/brand-glyph.test.ts`:

```ts
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
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/lib/automation/brand-glyph.test.ts`
Expected: FAIL - `Failed to resolve import "./brand-glyph"`.

- [ ] **Step 4: Write the implementation**

`src/lib/automation/brand-glyph.ts` - import only the four marks actually used, so the
other ~3000 icons never enter the bundle:

```ts
import {
  siClaude,
  siCline,
  siCursor,
  siGooglegemini,
  type SimpleIcon,
} from "simple-icons";

export type BrandGlyph = { title: string; path: string; hex: string };

// Only the marks the icon set actually ships for our agents. Adding an agent
// with a mark means adding it here; brand-glyph.test.ts fails if a registry
// iconSlug has no entry.
const GLYPHS: Record<string, SimpleIcon> = {
  claude: siClaude,
  cline: siCline,
  cursor: siCursor,
  googlegemini: siGooglegemini,
};

export function resolveBrandGlyph(slug: string): BrandGlyph | null {
  const icon = GLYPHS[slug];
  if (!icon) return null;
  return { title: icon.title, path: icon.path, hex: icon.hex };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/automation/brand-glyph.test.ts`
Expected: PASS - 4 tests.

If the `SimpleIcon` type or the `si<Slug>` export names differ in the installed version,
check `node_modules/simple-icons/index.d.ts` and adjust the import, not the test.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/automation/brand-glyph.ts src/lib/automation/brand-glyph.test.ts
git commit -m "feat: resolve agent brand marks from simple-icons"
```

---

## Task 4: Navigation entry

**Files:**
- Modify: `src/lib/nav-config.ts`
- Test: `src/lib/nav-config.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/nav-config.test.ts`, inside the existing `describe("findNavItem", ...)` block:

```ts
  it("exposes Automation as a live workspace route", () => {
    const item = findNavItem("/dashboard/automation");
    expect(item?.label).toBe("Automation");
    expect(item?.status).toBe("live");
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/nav-config.test.ts`
Expected: FAIL - `expected undefined to be 'Automation'`.

- [ ] **Step 3: Add the nav item**

In `src/lib/nav-config.ts`, add `Bot` to the existing `lucide-react` import (alphabetical - it goes first, before `BarChart3`):

```ts
import {
  BarChart3,
  Bot,
  Download,
  FileText,
  Inbox,
  LayoutDashboard,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react"
```

Then add the item to the `Workspace` group, immediately after the `Inbox` entry:

```ts
      { label: "Inbox", href: "/dashboard/inbox", icon: Inbox, status: "live" },
      {
        label: "Automation",
        href: "/dashboard/automation",
        icon: Bot,
        status: "live",
      },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/nav-config.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/nav-config.ts src/lib/nav-config.test.ts
git commit -m "feat: add Automation to dashboard navigation"
```

---

## Task 5: Shared copy button

`src/app/dashboard/copy-email-button.tsx` is used in exactly one place
(`src/app/dashboard/settings/page.tsx:77`). Generalize it instead of writing a second
copy button for the Automation page, and give it the clipboard failure handling the
current one lacks.

**Files:**
- Create: `src/components/dashboard/copy-button.tsx`
- Modify: `src/app/dashboard/settings/page.tsx`
- Delete: `src/app/dashboard/copy-email-button.tsx`

- [ ] **Step 1: Create the component**

`src/components/dashboard/copy-button.tsx`:

```tsx
"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch (error) {
      // Clipboard API is unavailable outside secure contexts and can be
      // permission-denied - the value stays on screen to copy by hand.
      console.error("Failed to copy value to clipboard", error);
      toast.error("Could not copy. Select the text and copy it manually.");
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleCopy}>
      {copied ? (
        <CheckIcon data-icon="inline-start" />
      ) : (
        <CopyIcon data-icon="inline-start" />
      )}
      {copied ? copiedLabel : label}
    </Button>
  );
}
```

- [ ] **Step 2: Point Settings at it**

In `src/app/dashboard/settings/page.tsx`, replace the import:

```ts
import { CopyEmailButton } from "../copy-email-button";
```

with:

```ts
import { CopyButton } from "@/components/dashboard/copy-button";
```

and the usage:

```tsx
                  <CopyEmailButton email={inbox.email_address} />
```

with:

```tsx
                  <CopyButton value={inbox.email_address} />
```

- [ ] **Step 3: Confirm nothing else imports the old component, then delete it**

Run: `npx rg -n "copy-email-button|CopyEmailButton" src`
Expected: no matches.

Then: `git rm src/app/dashboard/copy-email-button.tsx`

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/copy-button.tsx src/app/dashboard/settings/page.tsx
git commit -m "refactor: generalize copy-email button into a shared CopyButton"
```

---

## Task 6: Share the inbox-creation button

The Automation page needs the same "Create forwarding address" CTA that Settings has.
Move the component out of the Settings route folder rather than importing across routes,
and make `createInbox()` revalidate both pages.

**Files:**
- Create: `src/components/dashboard/create-inbox-button.tsx`
- Delete: `src/app/dashboard/settings/create-inbox-button.tsx`
- Modify: `src/app/dashboard/settings/page.tsx`
- Modify: `src/app/dashboard/actions.ts`

- [ ] **Step 1: Create the moved component**

`src/components/dashboard/create-inbox-button.tsx` - identical to the current file except
for the `createInbox` import path:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MailPlus } from "lucide-react";
import { createInbox } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function CreateInboxButton() {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      const result = await createInbox();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setDone(true);
      toast.success(
        result.alreadyExisted
          ? "You already have a forwarding address."
          : `Forwarding address created: ${result.email}`,
      );
      router.refresh();
    });
  }

  return (
    <Button size="sm" onClick={handleClick} disabled={isPending || done}>
      {isPending ? (
        <Spinner data-icon="inline-start" />
      ) : (
        <MailPlus data-icon="inline-start" />
      )}
      {isPending ? "Creating..." : "Create forwarding address"}
    </Button>
  );
}
```

- [ ] **Step 2: Update the Settings import and delete the old file**

In `src/app/dashboard/settings/page.tsx`, replace:

```ts
import { CreateInboxButton } from "./create-inbox-button";
```

with:

```ts
import { CreateInboxButton } from "@/components/dashboard/create-inbox-button";
```

Then: `git rm src/app/dashboard/settings/create-inbox-button.tsx`

- [ ] **Step 3: Revalidate the Automation page too**

In `src/app/dashboard/actions.ts`, there are three `revalidatePath("/dashboard/settings");`
calls inside `createInbox()` (the already-exists branch, the unique-violation branch, and
the success path). Add a matching line after **each** of them:

```ts
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/automation");
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/create-inbox-button.tsx src/app/dashboard/settings/page.tsx src/app/dashboard/actions.ts
git commit -m "refactor: share CreateInboxButton and revalidate the automation page"
```

---

## Task 7: Automation page components

Five presentational components. None of them queries anything. Layout follows the
references in the header: the address and its status appear once at the top, three
verb-first steps sit under it, and the grid is grouped by agent kind with exactly one
primary action per card.

**Files:**
- Create: `src/components/dashboard/automation/connection-panel.tsx`
- Create: `src/components/dashboard/automation/setup-steps.tsx`
- Create: `src/components/dashboard/automation/brand-glyph.tsx`
- Create: `src/components/dashboard/automation/agent-card.tsx`
- Create: `src/components/dashboard/automation/agent-grid.tsx`
- Create: `src/components/dashboard/automation/automation-view.tsx`

All of them use design-system tokens only: `rounded-[14px]` cards with no shadow,
`rounded-[8px]` on small tiles and code, 13px titles, 12px body, 11px mono labels,
`duration-150` transitions. No gradients, no shadows, no em-dash characters in copy.

- [ ] **Step 1: Create the connection panel**

`src/components/dashboard/automation/connection-panel.tsx`:

```tsx
import { CheckCircle2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CopyButton } from "@/components/dashboard/copy-button";
import { CreateInboxButton } from "@/components/dashboard/create-inbox-button";
import { AUTOMATION_STATUS } from "@/constants/automation";

// The address is a workspace-level resource, so it is presented once, here,
// with its status. Agent cards never repeat it.
export function ConnectionPanel({
  forwardAddress,
  receivedCount,
}: {
  forwardAddress: string | null;
  receivedCount: number;
}) {
  const isConnected = receivedCount > 0;

  return (
    <Card className="rounded-[14px] shadow-none">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-[13px] font-semibold">
            Your forwarding address
          </CardTitle>
          {forwardAddress ? (
            <Badge
              variant="outline"
              className={
                isConnected
                  ? "gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                  : "gap-1"
              }
            >
              {isConnected ? (
                <CheckCircle2 className="size-3" />
              ) : (
                <Clock className="size-3" />
              )}
              {isConnected
                ? `${AUTOMATION_STATUS.CONNECTED_LABEL}, ${receivedCount} received`
                : AUTOMATION_STATUS.WAITING_LABEL}
            </Badge>
          ) : null}
        </div>
        <CardDescription className="text-[13px]">
          Give this address to your AI agent. It decides which emails are invoices and
          forwards only those. Nothing else in your mailbox is touched.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {forwardAddress ? (
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-[8px] bg-muted px-3 py-1.5 font-mono text-[13px]">
              {forwardAddress}
            </code>
            <CopyButton
              value={forwardAddress}
              label="Copy address"
              copiedLabel="Address copied"
            />
          </div>
        ) : (
          <CreateInboxButton />
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create the setup steps**

`src/components/dashboard/automation/setup-steps.tsx`:

```tsx
import { AUTOMATION_SETUP_STEPS } from "@/constants/automation";

export function SetupSteps() {
  return (
    <ol className="grid gap-3 sm:grid-cols-3">
      {AUTOMATION_SETUP_STEPS.map((step, index) => (
        <li key={step.title} className="rounded-[14px] border border-border p-4">
          <span className="font-mono text-[11px] text-muted-foreground">
            {index + 1}
          </span>
          <h3 className="mt-1 text-[13px] font-semibold tracking-tight">{step.title}</h3>
          <p className="mt-1 text-[12px] text-muted-foreground">{step.body}</p>
        </li>
      ))}
    </ol>
  );
}
```

- [ ] **Step 3: Create the brand glyph**

`src/components/dashboard/automation/brand-glyph.tsx`:

```tsx
import { resolveBrandGlyph } from "@/lib/automation/brand-glyph";

/**
 * Brand mark for an agent, or a letter tile when the icon set ships none.
 * Both render in the same 28px rounded tile so a mixed grid stays aligned.
 * The mark inherits the foreground token rather than its brand hex, so it
 * reads correctly in both themes and does not introduce a second accent.
 */
export function BrandGlyph({ name, slug }: { name: string; slug?: string }) {
  const glyph = slug ? resolveBrandGlyph(slug) : null;

  if (!glyph) {
    return (
      <span
        aria-hidden="true"
        className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-muted font-mono text-[11px] font-medium uppercase text-muted-foreground"
      >
        {name.slice(0, 2)}
      </span>
    );
  }

  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-muted">
      <svg role="img" aria-label={glyph.title} viewBox="0 0 24 24" className="size-4 fill-foreground">
        <path d={glyph.path} />
      </svg>
    </span>
  );
}
```

- [ ] **Step 4: Create the agent card**

`src/components/dashboard/automation/agent-card.tsx` - one primary action, one quiet
link, matching how the reference directories present an entry:

```tsx
import { ArrowUpRight } from "lucide-react";
import type { AutomationAgent } from "@/lib/automation/agents";
import { buildForwardPrompt } from "@/lib/automation/prompt";
import { CopyButton } from "@/components/dashboard/copy-button";
import { BrandGlyph } from "./brand-glyph";

export function AgentCard({
  agent,
  forwardAddress,
}: {
  agent: AutomationAgent;
  forwardAddress: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-border p-4 transition-colors duration-150 hover:bg-muted/40">
      <div className="flex items-center gap-2">
        <BrandGlyph name={agent.name} slug={agent.iconSlug} />
        <h3 className="text-[13px] font-semibold tracking-tight">{agent.name}</h3>
      </div>
      <p className="text-[12px] leading-relaxed text-muted-foreground">
        {agent.description}
      </p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
        <CopyButton
          value={buildForwardPrompt(forwardAddress)}
          label="Copy prompt"
          copiedLabel="Prompt copied"
        />
        {agent.docsUrl ? (
          <a
            href={agent.docsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[12px] text-muted-foreground underline-offset-4 transition-colors duration-150 hover:text-foreground hover:underline"
          >
            Setup guide
            <ArrowUpRight className="size-3" />
          </a>
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create the grid**

`src/components/dashboard/automation/agent-grid.tsx`:

```tsx
import { groupAgentsByKind, type AutomationAgent } from "@/lib/automation/agents";
import { AUTOMATION_KIND_LABEL } from "@/constants/automation";
import { AgentCard } from "./agent-card";

export function AgentGrid({
  agents,
  forwardAddress,
}: {
  agents: readonly AutomationAgent[];
  forwardAddress: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      {groupAgentsByKind(agents).map((group) => (
        <section key={group.kind} className="flex flex-col gap-3">
          <h2 className="text-[13px] font-semibold tracking-tight">
            {AUTOMATION_KIND_LABEL[group.kind]}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} forwardAddress={forwardAddress} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Create the view**

`src/components/dashboard/automation/automation-view.tsx`:

```tsx
import { ContentShell } from "@/components/dashboard/content-shell";
import { ConnectionPanel } from "./connection-panel";
import { SetupSteps } from "./setup-steps";
import { AgentGrid } from "./agent-grid";
import type { AutomationAgent } from "@/lib/automation/agents";

export function AutomationView({
  forwardAddress,
  receivedCount,
  agents,
}: {
  forwardAddress: string | null;
  receivedCount: number;
  agents: readonly AutomationAgent[];
}) {
  return (
    <ContentShell
      title="Automation"
      description="Let your AI agent forward invoices for you. No mailbox access required."
    >
      <div className="flex flex-col gap-5">
        <ConnectionPanel forwardAddress={forwardAddress} receivedCount={receivedCount} />

        {forwardAddress ? (
          <>
            <SetupSteps />
            <AgentGrid agents={agents} forwardAddress={forwardAddress} />
          </>
        ) : (
          <p className="text-[13px] text-muted-foreground">
            Create your forwarding address above to get the agent setup prompts.
          </p>
        )}
      </div>
    </ContentShell>
  );
}
```

The `forwardAddress ?` guard is what keeps `buildForwardPrompt()`'s throw unreachable in
normal operation: no address means no cards.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 8: Commit**

```bash
git add src/components/dashboard/automation
git commit -m "feat: add automation page components"
```

---

## Task 8: The page route

**Files:**
- Create: `src/app/dashboard/automation/page.tsx`

- [ ] **Step 1: Create the route**

`src/app/dashboard/automation/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AutomationView } from "@/components/dashboard/automation/automation-view";
import { AUTOMATION_AGENTS } from "@/lib/automation/agents";
import { INBOX_SOURCE_FILTER } from "@/constants/inbox";

export default async function AutomationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: inbox }, { count, error: countError }] = await Promise.all([
    supabase
      .from("inboxes")
      .select("email_address")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("source", INBOX_SOURCE_FILTER.EMAIL),
  ]);

  // A failed count must not break the page - the address and prompts are
  // still useful, so fall back to the "waiting" state.
  if (countError) {
    console.error("Failed to load automation status", user.id, countError);
  }

  return (
    <AutomationView
      forwardAddress={inbox?.email_address ?? null}
      receivedCount={count ?? 0}
      agents={AUTOMATION_AGENTS}
    />
  );
}
```

`redirect()` is a top-level statement, never inside a `try` - per `.claude/rules/errors.md`.

- [ ] **Step 2: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: typecheck silent; build succeeds and lists `/dashboard/automation` in the route table.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/automation/page.tsx
git commit -m "feat: add /dashboard/automation page"
```

---

## Task 9: Verify every install link

The registry ships candidate URLs. Each one must be confirmed to load and to be the page a
user actually needs (persistent instructions / rules / automations), or removed.

**Files:**
- Modify: `src/lib/automation/agents.ts`

- [ ] **Step 1: Check each URL**

For each of the seven `docsUrl` values in `AUTOMATION_AGENTS`, fetch the URL (WebFetch, or
`curl -sSI -o /dev/null -w "%{http_code} %{url_effective}\n" -L <url>`) and record:
status code, final URL after redirects, and whether the page documents custom
instructions / rules / memory for that agent.

- [ ] **Step 2: Fix the registry**

For any URL that returns a non-2xx status, redirects somewhere unrelated, or isn't about
persistent instructions: either replace it with the correct page found from that vendor's
docs index, or delete the `docsUrl` property for that agent entirely. Never keep a guessed
link. Example of the removal form:

```ts
  {
    id: AUTOMATION_AGENT_ID.OPENCLAW,
    name: "OpenClaw",
    description: "Paste the rule into your agent's standing instructions.",
  },
```

- [ ] **Step 3: Re-run the registry tests**

Run: `npx vitest run src/lib/automation/agents.test.ts`
Expected: PASS - the https assertion still holds for whatever links remain.

- [ ] **Step 4: Commit**

```bash
git add src/lib/automation/agents.ts
git commit -m "fix: verify agent install links"
```

---

## Task 10: Manual verification in the browser

UI, Server Components, and Server Actions aren't unit-tested in this project
(`.claude/rules/testing.md`) - they get a manual pass instead.

**Files:** none (verification only)

- [ ] **Step 1: Start the local stack**

```bash
npx supabase start
```

Then start the dev server with the preview tool (never `npm run dev` via Bash) and open
`http://localhost:3000/dashboard/automation`.

- [ ] **Step 2: Verify the no-inbox state**

Sign in as a user with no row in `inboxes`. Expected: no status badge, the
"Create forwarding address" button, and the "Create your forwarding address above..."
message instead of agent cards. Click the button. Expected: success toast, page refreshes,
address appears, cards appear.

- [ ] **Step 3: Verify the waiting state**

With an inbox but zero invoices where `source='email'`. Expected: badge reads
"Waiting for your first forwarded email" with the clock icon.

- [ ] **Step 4: Verify the connected state**

Insert or forward at least one email-sourced invoice for the user, reload. Expected: green
badge "Connected - N received", N matching the row count.

- [ ] **Step 5: Verify copy actions**

Click *Copy prompt* on two different cards. Expected: label flips to "Prompt copied" for
~2s; pasted text is the full prompt with the real address, no placeholder. Click
*Copy address* in the top panel. Expected: exactly the address. Confirm no card carries a
second copy button.

- [ ] **Step 6: Verify grouping and brand marks**

Expected: three labelled groups (Chat agents, Coding agents, Anything else) in that order,
eight cards total. Claude, Gemini, Cursor and Cline show a brand mark; ChatGPT, Codex,
OpenClaw and Other agents show a letter tile at the same 28px size, so rows stay aligned.

- [ ] **Step 7: Verify links, theme, and narrow viewport**

Every *Setup guide* link opens in a new tab. Toggle dark/light: badge, brand marks, letter
tiles, step numbers and the code block all stay legible (the marks inherit the foreground
token, so they must not disappear in either theme). Resize to mobile width: the step row
and card grid each collapse to one column and the page does not scroll horizontally.

- [ ] **Step 8: Check the console and server logs**

Read console messages and dev-server logs. Expected: no errors, no React hydration
warnings.

---

## Task 11: Record the feature and run the full gate

**Files:**
- Create: `docs/automation.md`

- [ ] **Step 1: Write the feature doc**

`docs/automation.md`:

```markdown
# Automation page

`/dashboard/automation` is the onboarding surface for the product's core idea: the user's
own AI agent decides which emails are invoices and forwards only those to their workspace
address. No Gmail OAuth, no mailbox access.

## What the page does

- Shows the user's AgentMail forwarding address, or provisions one via the shared
  `CreateInboxButton` (`createInbox()` in `src/app/dashboard/actions.ts`).
- Renders one card per supported agent (`AUTOMATION_AGENTS` in
  `src/lib/automation/agents.ts`), grouped by kind, each with a copy-to-clipboard prompt
  from `buildForwardPrompt()` and a link to that agent's instructions docs.
- Reports connection status for the workspace: "waiting" until at least one invoice with
  `source='email'` exists, "connected" after that.

## Layout references

Structure is taken from shipping products, not invented: grouped card sections and
one-sentence action copy from the [Linear integrations directory](https://linear.app/integrations);
single-description cards from [Vercel Marketplace](https://vercel.com/marketplace); one
verb-first action per card from [Cursor's MCP install links](https://cursor.com/docs/context/mcp/install-links);
and the intake address shown once with a status pill from
[Linear email intake](https://linear.app/integrations/create-issues-via-email). Visual
style stays inside [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md) tokens rather than copying those
products' styling.

Brand marks come from `simple-icons` as local SVG paths. The set has no OpenAI/ChatGPT,
Codex or OpenClaw mark, so those cards use a letter tile of the same size; marks are never
redrawn by hand.

## Deliberate limitations

- **Status is workspace-level, not per agent.** Inbound mail carries no signal of which
  agent forwarded it, so a per-card badge would be a guess.
- **One prompt for all agents.** Agents differ in where the instruction is stored, not in
  what it says. Per-agent prompt variants were considered and rejected as maintenance cost
  with no user benefit.
- **No synthetic self-test.** A "send me a sample invoice" button would prove our pipeline
  works, not that the user's agent is configured, and costs an LLM call per click.
- **No MCP server or downloadable skill.** Tracked as a possible separate product.

## Files

| File | Role |
| --- | --- |
| `src/app/dashboard/automation/page.tsx` | Server Component: auth guard, inbox + count queries |
| `src/components/dashboard/automation/` | View, connection panel, setup steps, grid, card, brand glyph |
| `src/lib/automation/agents.ts` | Agent registry and grouping (unit-tested) |
| `src/lib/automation/prompt.ts` | Forwarding prompt template (unit-tested) |
| `src/lib/automation/brand-glyph.ts` | simple-icons lookup with null fallback (unit-tested) |
| `src/constants/automation.ts` | Agent ids, kinds, group labels, setup steps, status labels |
```

- [ ] **Step 2: Run the full gate**

```bash
npm run test && npx tsc --noEmit && npm run lint && npm run build
```

Expected: all four succeed. Fix anything that fails before continuing - do not commit over
a red gate.

- [ ] **Step 3: Commit**

```bash
git add docs/automation.md
git commit -m "docs: record the automation page"
```

---

## Done when

- [ ] `npm run test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` all pass.
- [ ] Task 10's eight browser checks all pass on the local dev server.
- [ ] Every `docsUrl` still in the registry was fetched and confirmed in Task 9.
- [ ] No card repeats the forwarding address, and the grid renders three labelled groups.
