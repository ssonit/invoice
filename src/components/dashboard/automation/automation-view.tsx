import { ContentShell } from "@/components/dashboard/content-shell";
import { ConnectionPanel } from "./connection-panel";
import { PromptBlock } from "./prompt-block";
import { SetupSteps } from "./setup-steps";
import { AgentGrid } from "./agent-grid";
import type { AutomationAgent } from "@/lib/automation/agents";
import { getDashboardDictionary } from "@/lib/dashboard/locale-server";

export async function AutomationView({
  forwardAddress,
  receivedCount,
  agents,
}: {
  forwardAddress: string | null;
  receivedCount: number;
  agents: readonly AutomationAgent[];
}) {
  const { t } = await getDashboardDictionary();
  return (
    <ContentShell
      title={t.automation.title}
      description={t.automation.description}
    >
      <div className="flex flex-col gap-5">
        <ConnectionPanel
          forwardAddress={forwardAddress}
          receivedCount={receivedCount}
        />

        {forwardAddress ? (
          <>
            <PromptBlock forwardAddress={forwardAddress} />
            <SetupSteps />
            <AgentGrid agents={agents} />
          </>
        ) : (
          <p className="text-[13px] text-muted-foreground">
            {t.automation.createFirst}
          </p>
        )}
      </div>
    </ContentShell>
  );
}
