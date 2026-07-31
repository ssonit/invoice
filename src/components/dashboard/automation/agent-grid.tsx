import { groupAgentsByKind, type AutomationAgent } from "@/lib/automation/agents";
import { AUTOMATION_KIND_LABEL } from "@/constants/automation";
import { AgentCard } from "./agent-card";

export function AgentGrid({ agents }: { agents: readonly AutomationAgent[] }) {
  return (
    <div className="flex flex-col gap-5">
      {groupAgentsByKind(agents).map((group) => (
        <section key={group.kind} className="flex flex-col gap-2">
          <h2 className="text-[13px] font-semibold tracking-tight">
            {AUTOMATION_KIND_LABEL[group.kind]}
          </h2>
          <div className="flex flex-col gap-2">
            {group.agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
