# Landing Agents Section — Design Spec

**Date:** 2026-07-30
**Status:** Implemented

## Motivation

The landing page copy positions "Your AI already reads your inbox" but never names which AI agents. After the How it works section explains the setup, visitors need to see their tool's logo to trust it works with what they already use.

## Design decisions

### Placement

After `#how` (How it works), before `#features` (Features pan). The section gets `id="agents"` for nav/footer scroll targeting.

### Data source

Reuses `AUTOMATION_AGENTS` from `src/lib/automation/agents.ts` and `BrandGlyph` from `src/components/dashboard/automation/brand-glyph.tsx`. No duplication of the agent list in the landing dictionary.

### Layout

Compact logo row — small tiles (name + brand mark or letter tile). Not a full card grid.

### Motion

GSAP ScrollTrigger fade-up on tiles (staggered), respecting `prefers-reduced-motion`.

### Nav & Footer

- Nav: "Agents" (EN) / "AI agents" (VI) — scrolls to `#agents`
- Footer Product links: same label, same scroll behavior
