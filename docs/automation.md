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
| `src/app/dashboard/automation/page.tsx` | Server Component: auth guard (via the dashboard layout), inbox + count queries |
| `src/components/dashboard/automation/` | View, connection panel, setup steps, grid, card, brand glyph |
| `src/lib/automation/agents.ts` | Agent registry and grouping (unit-tested) |
| `src/lib/automation/prompt.ts` | Forwarding prompt template (unit-tested) |
| `src/lib/automation/brand-glyph.ts` | simple-icons lookup with null fallback (unit-tested) |
| `src/constants/automation.ts` | Agent ids, kinds, group labels, setup steps, status labels |

## Manual verification (2026-07-29)

Verified end-to-end against a local Supabase instance with a real test user, cycling
through all three connection states by inserting/removing `inboxes`/`invoices` rows
directly (AgentMail itself isn't reachable in this environment, so its webhook-driven
inbound flow wasn't exercised — only the page's read side was verified):

- No inbox yet → no status pill, "Create forwarding address" CTA, fallback message
  instead of the agent grid.
- Inbox created, no email-sourced invoices → "Waiting for your first forwarded email"
  badge.
- One email-sourced invoice present → "Connected, 1 received" badge, count matches.
- Nav entry lands between Inbox and Vendors, exactly one "Copy address" button (on the
  connection panel) and exactly 8 "Copy prompt" buttons (one per agent card, no per-card
  address duplication).
- Three groups render in order (Chat agents, Coding agents, Anything else); Claude,
  Gemini, Cursor and Cline show a real `simple-icons` mark inheriting the `foreground`
  token; ChatGPT, Codex, OpenClaw and Other agents show a same-size letter tile.
- Mobile viewport (375px): all grids collapse to a single column, no horizontal overflow.
- This app runs `forcedTheme="dark"` globally (`src/components/theme-provider.tsx`) —
  there is no light mode to verify; dark-mode contrast was checked directly (foreground
  text/icons render at `#fafafa` against the `#0a0a0a` page background).
- No console errors on load.
