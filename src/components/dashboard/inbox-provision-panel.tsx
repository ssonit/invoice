"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { createCheckoutUrl } from "@/app/dashboard/actions";
import { CreateInboxButton } from "@/components/dashboard/create-inbox-button";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/**
 * Create-forwarding-address control. Team (or billing-disabled / unlock)
 * gets CreateInboxButton; Starter gets an upgrade CTA. Callers that already
 * have an inbox should render the address themselves (grandfathered).
 */
export function InboxProvisionPanel({ canProvision }: { canProvision: boolean }) {
  const [isPending, startTransition] = useTransition();

  if (canProvision) {
    return <CreateInboxButton />;
  }

  function handleUpgrade() {
    startTransition(async () => {
      const result = await createCheckoutUrl();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      window.location.href = result.url;
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] text-muted-foreground">
        Forwarding inbox is available on the Team plan. Upgrade to get a dedicated
        address that parses invoices from email automatically.
      </p>
      <Button size="sm" className="w-fit" disabled={isPending} onClick={handleUpgrade}>
        {isPending ? <Spinner data-icon="inline-start" /> : null}
        {isPending ? "Redirecting..." : "Upgrade to Team"}
      </Button>
    </div>
  );
}
