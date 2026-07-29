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
