import { CheckCircle2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CopyButton } from "@/components/dashboard/copy-button";
import { CreateInboxButton } from "@/components/dashboard/create-inbox-button";
import { DeleteInboxButton } from "@/components/dashboard/delete-inbox-button";
import { getDashboardDictionary } from "@/lib/dashboard/locale-server";

// The address is a workspace-level resource, so it is presented once, here,
// with its status. Agent cards never repeat it.
export async function ConnectionPanel({
  forwardAddress,
  receivedCount,
}: {
  forwardAddress: string | null;
  receivedCount: number;
}) {
  const { t } = await getDashboardDictionary();
  const isConnected = receivedCount > 0;

  return (
    <Card className="rounded-[14px] shadow-none">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-[13px] font-semibold">
            {t.automation.panelTitle}
          </CardTitle>
          {forwardAddress ? (
            <Badge
              variant="outline"
              className={
                isConnected
                  ? "gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                  : "gap-1"
              }
            >
              {isConnected ? (
                <CheckCircle2 className="size-3" />
              ) : (
                <Clock className="size-3" />
              )}
              {isConnected
                ? t.automation.connected.replace("{count}", String(receivedCount))
                : t.automation.waiting}
            </Badge>
          ) : null}
        </div>
        <CardDescription className="text-[13px]">
          {t.automation.panelDescription}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {forwardAddress ? (
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-[8px] bg-muted px-3 py-1.5 font-mono text-[13px]">
              {forwardAddress}
            </code>
            <CopyButton
              value={forwardAddress}
              label={t.automation.copyAddress}
              copiedLabel={t.automation.addressCopied}
            />
            <DeleteInboxButton forwardAddress={forwardAddress} />
          </div>
        ) : (
          <CreateInboxButton />
        )}
      </CardContent>
    </Card>
  );
}
