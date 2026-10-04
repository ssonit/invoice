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
import { AUTOMATION_STATUS } from "@/constants/automation";

// The address is a workspace-level resource, so it is presented once, here,
// with its status. Agent cards never repeat it.
export function ConnectionPanel({
  forwardAddress,
  receivedCount,
}: {
  forwardAddress: string | null;
  receivedCount: number;
}) {
  const isConnected = receivedCount > 0;

  return (
    <Card className="rounded-[14px] shadow-none">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-[13px] font-semibold">
            Your forwarding address
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
                ? `${AUTOMATION_STATUS.CONNECTED_LABEL}, ${receivedCount} received`
                : AUTOMATION_STATUS.WAITING_LABEL}
            </Badge>
          ) : null}
        </div>
        <CardDescription className="text-[13px]">
          Give this address to your AI agent. It decides which emails are invoices and
          forwards only those. Nothing else in your mailbox is touched.
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
              label="Copy address"
              copiedLabel="Address copied"
            />
          </div>
        ) : (
          <CreateInboxButton />
        )}
      </CardContent>
    </Card>
  );
}
