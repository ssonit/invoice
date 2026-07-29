import { AUTOMATION_SETUP_STEPS } from "@/constants/automation";

export function SetupSteps() {
  return (
    <ol className="grid gap-3 sm:grid-cols-3">
      {AUTOMATION_SETUP_STEPS.map((step, index) => (
        <li key={step.title} className="rounded-[14px] border border-border p-4">
          <span className="font-mono text-[11px] text-muted-foreground">
            {index + 1}
          </span>
          <h3 className="mt-1 text-[13px] font-semibold tracking-tight">{step.title}</h3>
          <p className="mt-1 text-[12px] text-muted-foreground">{step.body}</p>
        </li>
      ))}
    </ol>
  );
}
