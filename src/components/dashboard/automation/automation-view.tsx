import { ContentShell } from "@/components/dashboard/content-shell";
import { ConnectionPanel } from "./connection-panel";
import { PromptBlock } from "./prompt-block";
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
            <PromptBlock forwardAddress={forwardAddress} />
            <SetupSteps />
            <AgentGrid agents={agents} />
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
