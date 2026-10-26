import { buildForwardPrompt } from "@/lib/automation/prompt";
import { CopyButton } from "@/components/dashboard/copy-button";
import { getDashboardDictionary } from "@/lib/dashboard/locale-server";

export async function PromptBlock({ forwardAddress }: { forwardAddress: string }) {
  const { t } = await getDashboardDictionary();
  const prompt = buildForwardPrompt(forwardAddress);

  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-border p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-semibold tracking-tight">
          {t.automation.promptTitle}
        </h2>
        <CopyButton value={prompt} label={t.automation.copyPrompt}
          copiedLabel={t.automation.promptCopied} />
      </div>
      <pre className="whitespace-pre-wrap rounded-[10px] bg-muted/50 p-3 text-[12px] leading-relaxed text-muted-foreground">
        {prompt}
      </pre>
    </div>
  );
}
