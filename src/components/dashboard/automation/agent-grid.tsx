import { groupAgentsByKind, type AutomationAgent } from "@/lib/automation/agents";
import { AUTOMATION_KIND_LABEL } from "@/constants/automation";
import { getDashboardDictionary } from "@/lib/dashboard/locale-server";
import { AgentCard } from "./agent-card";

export async function AgentGrid({ agents }: { agents: readonly AutomationAgent[] }) {
  const { t } = await getDashboardDictionary();
  return (
    <div className="flex flex-col gap-5">
      {groupAgentsByKind(agents).map((group) => (
        <section key={group.kind} className="flex flex-col gap-2">
          <h2 className="text-[13px] font-semibold tracking-tight">
            {t.automation.kinds[group.kind] ?? AUTOMATION_KIND_LABEL[group.kind]}
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
