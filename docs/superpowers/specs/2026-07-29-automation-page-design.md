# Automation Page — AI Agent Onboarding

**Date:** 2026-07-29
**Status:** Approved for implementation
**Source:** `Invoice_Reader_Product_Ideas.md` §4 (AI Agent Integration), §7 (USP)

## Goal

The product's core differentiation is that the user's own AI agent (Claude, ChatGPT,
Gemini, …) decides which emails are invoices and forwards only those to a per-workspace
address — no Gmail OAuth, no mailbox access. The ingestion half of that already ships:
AgentMail inbox per user, webhook → `process-inbound-email` → extraction → invoice rows.

What's missing is the half the user touches. Today the forwarding address appears only on
`/dashboard/settings` (`src/app/dashboard/settings/page.tsx:77`) with no explanation of
what to do with it. There is no page telling a user how to make their agent forward
invoices, no prompt to paste into that agent, and no signal that the setup worked.

`/dashboard/automation` closes that gap: one page that hands the user a forwarding
address, a ready-to-paste prompt per agent, and a connection status.

## Scope decision

The source document describes several independent subsystems. Only the Automation page is
in scope here. The others were assessed against the current code and deferred to their own
spec → plan → implementation cycles:

| Area | Status in repo today | Decision |
| --- | --- | --- |
| §3 Secure email ingestion | Already shipped (AgentMail inbox per user, webhook, auto-reply) | Nothing to do |
| §2 Queue instead of batching | Mostly shipped — `process-inbound-email` with `concurrencyLimit: 5`, retry 3, idempotency keys | Later spec: split per-attachment task so one bad file doesn't retry the whole email |
| §1 Provider routing (text PDF → DeepSeek, scanned PDF / image → Gemini) | Not built — one provider for every input via `EXTRACTION_PROVIDER`, no PDF text extraction step | Later spec |
| §1 SHA256 cache | Half built — `sha256Hex` + `invoices.content_hash` cover manual uploads only; the email path dedupes on `source_message_id` and re-pays for identical attachments | Later spec |
| §1 Known-template regex parser | Not built | Deferred (YAGNI until repeat-vendor data exists) |
| §5/§7 Positioning copy | Landing exists, doesn't lead with the agent-decides angle | Later spec (`src/lib/landing/dictionary.ts`) |
| §6 Connectors (Drive/Dropbox/Slack/…) | Not built | Not planned — the `ExtractionInput` seam already leaves room |

## Design decisions

**Card depth.** Cards are informational, not integrations. `Install` is an external link
to that agent's own documentation for custom instructions / rules / automations. There is
no MCP server, no downloadable skill, and no button that sends a synthetic test invoice —
both were considered and deferred (a synthetic send proves our pipeline works, not that
the user's agent is configured, and costs an LLM call per click).

**Connection status is workspace-level, not per-card.** An inbound email carries no
indication of which agent forwarded it, so a per-card "connected" badge would be a lie.
One banner above the grid reports the whole workspace: waiting vs. connected.

**One shared prompt template for all 8 agents.** Agents differ in where you paste the
instruction, not in what the instruction says. The registry carries per-agent name,
description and docs link; `buildForwardPrompt()` produces the text.

**Server Component + static registry** (over a client page polling an API route, or a
DB-backed registry). The page reads its own data server-side; the agent list and prompt
builder are pure functions in `src/lib/automation/`, which is the layer this project
unit-tests. No new API route, no new table, no migration.

## Visual design references

The layout is taken from how shipping products present integration and intake setup, not
invented here. Four references, and what each one changes about this page:

| Reference | Pattern | Applied here |
| --- | --- | --- |
| [Linear integrations directory](https://linear.app/integrations) | Cards grouped into labelled categories; each card is a brand mark, a name, and one action-oriented sentence | Eight agents are grouped as Chat agents / Coding agents / Other rather than one flat run of tiles |
| [Vercel Marketplace](https://vercel.com/marketplace) | Card is a logo, a name, and a single ~80-100 character description; the card is one target, not a button bar | Each card carries one primary action, not a row of equal-weight buttons |
| [Cursor MCP install links](https://cursor.com/docs/context/mcp/install-links) | The 2026 install affordance is a single verb-first action per entry ("Add to Cursor") | The card's action is *Copy prompt*; the docs link is a quiet secondary |
| [Linear email intake](https://linear.app/integrations/create-issues-via-email) | The intake address and its live status live in one place, shown once | The forwarding address and status pill sit in the panel above the grid, and are **not** repeated on every card |

The last one reverses an earlier decision in this spec's own review: a *Copy address*
button on all eight cards means the same control eight times, which is the templated look
worth avoiding. The address is a workspace-level resource, so it is presented once.

**Style is not borrowed, only structure.** This project already has a strict token system
([`docs/DESIGN-SYSTEM.md`](../../DESIGN-SYSTEM.md)): cards are `rounded-[14px]` with
`shadow-none`, type is limited to 11/12/13/14/15px, hierarchy comes from weight and color
rather than size, transitions are 150/200/300ms only, and dashboard surfaces carry no
gradients. Every component below stays inside those tokens.

**Brand marks come from `simple-icons`** (v16.27.1), vendored as local SVG path data with
no external CDN request. The set covers `claude`, `googlegemini`, `cursor` and `cline`; it
has no OpenAI/ChatGPT, Codex, or OpenClaw mark, so those cards and the generic "Other
agents" card use a letter tile of identical size and shape. Redrawing a mark the icon set
deliberately does not ship is not an option.

## Architecture

```text
/dashboard/automation (server component)
        │
        ├── supabase: inboxes.email_address        (user's forwarding address)
        ├── supabase: count(invoices where source='email')   (connection signal)
        └── AUTOMATION_AGENTS + buildForwardPrompt()  (pure, from src/lib/automation/)
                    │
                    ▼
            AutomationView (props only, no queries)
                    ├── ConnectionPanel  — address, copy, status pill  (shown once)
                    ├── SetupSteps       — copy, paste, forward
                    └── AgentGrid        — grouped by kind
                            └── AgentCard — mark, name, one line, Copy prompt
```

State transition, end to end: user pastes the prompt into their agent → agent forwards a
real invoice email → AgentMail webhook → `process-inbound-email` → `invoices` row with
`source='email'` → next render the banner reads "Connected".

## Components

| File | Responsibility |
| --- | --- |
| `src/app/dashboard/automation/page.tsx` | Server component. `getUser()` guard with early `redirect("/login")`, parallel fetch of inbox row + email-sourced invoice count, renders `AutomationView`. Thin — no logic. |
| `src/components/dashboard/automation/automation-view.tsx` | Layout inside `ContentShell`. Pure props: `forwardAddress`, `receivedCount`, `agents`. |
| `src/components/dashboard/automation/connection-panel.tsx` | Forwarding address + copy + status badge. When the user has no inbox yet, renders a "Create forwarding address" button wired to the existing `createInbox()` server action (`src/app/dashboard/actions.ts:26`) — no new provisioning logic. |
| `src/components/dashboard/automation/setup-steps.tsx` | Three verb-first steps under the panel: copy the prompt, paste it into your agent, forward one invoice. |
| `src/components/dashboard/automation/agent-grid.tsx` | Groups the registry by `kind` and renders one labelled section per group. |
| `src/components/dashboard/automation/agent-card.tsx` | Brand mark (or letter tile), name, one-line action-oriented description, one primary action *Copy prompt*, and a quiet *Setup guide* link (`target="_blank" rel="noreferrer"`). No address button. |
| `src/components/dashboard/automation/brand-glyph.tsx` | Renders a `simple-icons` path when the agent has one, otherwise a letter tile of the same size. |
| `src/lib/automation/brand-glyph.ts` | `resolveBrandGlyph(slug)` — looks a slug up in `simple-icons` and returns its path/hex, or `null`. Pure, unit-tested. |
| `src/components/dashboard/copy-button.tsx` | Generalized from `src/app/dashboard/copy-email-button.tsx`: `CopyButton({ value, label, copiedLabel })`. `settings/page.tsx:77` migrates to it and the old file is removed. |
| `src/lib/automation/agents.ts` | `type AutomationAgent = { id; name; description; docsUrl?: string }` (optional — see the registry section), `AUTOMATION_AGENTS`, `findAutomationAgent(id)`. |
| `src/lib/automation/prompt.ts` | `buildForwardPrompt(forwardAddress: string): string`. The template is identical for every agent, so it takes no agent argument. |
| `src/constants/automation.ts` | Status labels and agent ids — no bare literals repeated across files. |
| `src/lib/nav-config.ts` | New "Automation" item in the Workspace group, `status: "live"`. |

## The agent registry

Eight agents, per §4: Claude, OpenClaw, ChatGPT, Gemini, Cursor, Codex, Cline, and a
generic "Other Agents" entry. Each entry also carries a `kind` (`chat` | `coding` |
`generic`) that drives the grid grouping, and an optional `iconSlug` naming its
`simple-icons` mark.

Descriptions are one action-oriented sentence in the style the reference directories use
("Add the rule to a project so it applies to every inbox check"), not a feature list.

`docsUrl` points at that vendor's own documentation page for custom instructions, rules,
or automations — the page a user needs in order to make the prompt persistent. Each URL is
verified to resolve during implementation (fetch it, confirm 200 and that the content is
the instructions/rules page); an agent whose docs page can't be confirmed ships without a
link rather than with a guessed one. "Other Agents" has no external link — its card
explains that any agent capable of reading and forwarding mail works, and offers the same
prompt.

## The prompt

`buildForwardPrompt()` produces the §4 template with the address substituted and all five
rules preserved verbatim in meaning:

```text
Whenever you receive an invoice, tax invoice, receipt, supplier invoice or accounting
document with a PDF or image attachment, automatically forward the original email to:

<forwardAddress>

Rules:
- Preserve subject
- Keep all attachments
- Do not modify the email body
- Ignore newsletters and marketing emails
- If uncertain, do not forward
```

`forwardAddress` is required and must be non-empty — an empty address would produce a
prompt that silently does nothing, which is a programming error, not an anticipated
outcome, so it throws (per `.claude/rules/errors.md`: expected failures are return values,
bugs throw). Cards only render once an address exists, so the throw is unreachable in
normal operation.

## Error handling

- **No inbox yet** — `createInbox()` already returns `{ ok: false; error }` with a generic,
  user-safe message; the panel renders `result.error` as-is. No raw driver text reaches the
  user.
- **Status count query fails** — log `console.error("Failed to load automation status", user.id, error)`
  and fall back to the "waiting" state. A broken count must not break the page; the address
  and prompts are still useful.
- **Clipboard unavailable** (non-secure context, denied permission) — catch, show a sonner
  error toast, and keep the value visible as selectable text so the user can copy manually.

## Testing

Unit tests (Vitest, per `.claude/rules/testing.md` — pure `src/lib/` logic):

- `src/lib/automation/prompt.test.ts` — address is embedded exactly once; all five rules
  present; output stable across calls; empty/whitespace-only address throws.
- `src/lib/automation/agents.test.ts` — exactly 8 entries; ids unique; every entry has a
  non-empty name and description; every `docsUrl`, when present, is `https:`; every
  `iconSlug`, when present, resolves in `simple-icons`.
- `src/lib/automation/brand-glyph.test.ts` — a known slug returns path and hex; an unknown
  slug returns `null` rather than throwing.
- `src/lib/nav-config.test.ts` — extended for the Automation item and its active-path
  matching.

Not unit-tested (established convention): the page, the server action wiring, and the UI
components. Verified manually instead, in-browser against the local dev server:

1. User with no inbox → create-address flow provisions and the panel updates.
2. User with an inbox but no email-sourced invoice → "waiting" banner.
3. User with at least one email-sourced invoice → "connected" banner with count.
4. Copy prompt / copy address both place the right text on the clipboard.
5. Light and dark theme, plus a narrow viewport for the card grid.

Gates before the feature is called done: `npm run test`, `npx tsc --noEmit`,
`npm run build`, plus the manual pass above.

## Out of scope

Synthetic "send a sample invoice" self-test; MCP server or downloadable agent skill;
detecting which agent forwarded a message; and every deferred item in the scope table.
