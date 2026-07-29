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
