import { ArrowUpRight } from "lucide-react";
import type { AutomationAgent } from "@/lib/automation/agents";
import { BrandGlyph } from "./brand-glyph";

export function AgentCard({ agent }: { agent: AutomationAgent }) {
  return (
    <div className="flex items-center gap-2 rounded-[10px] border border-border px-3 py-2 transition-colors duration-150 hover:bg-muted/40">
      <BrandGlyph name={agent.name} slug={agent.iconSlug} />
      <span className="text-[13px] font-medium">{agent.name}</span>
      {agent.docsUrl ? (
        <a
          href={agent.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1 text-[12px] text-muted-foreground underline-offset-4 transition-colors duration-150 hover:text-foreground hover:underline"
        >
          Setup guide
          <ArrowUpRight className="size-3" />
        </a>
      ) : null}
    </div>
  );
}
