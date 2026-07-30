"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Tag } from "lucide-react";
import {
  SUBSCRIPTION_CYCLE,
  SUBSCRIPTION_CYCLE_LABELS,
  type SubscriptionCycleConstant,
} from "@/constants/subscriptions";
import { markVendorAsSubscription } from "@/app/dashboard/vendors/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";

const CYCLES: SubscriptionCycleConstant[] = [
  SUBSCRIPTION_CYCLE.MONTHLY,
  SUBSCRIPTION_CYCLE.YEARLY,
];

export function MarkSubscriptionButton({ vendorKey }: { vendorKey: string }) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  function mark(cycle: SubscriptionCycleConstant) {
    startTransition(async () => {
      const result = await markVendorAsSubscription(vendorKey, cycle);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Marked as ${SUBSCRIPTION_CYCLE_LABELS[cycle]} subscription.`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button type="button" variant="outline" size="sm" disabled={isPending}>
            {isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Tag data-icon="inline-start" />
            )}
            Mark as subscription
          </Button>
        }
      />
      <DropdownMenuContent align="start">
        {CYCLES.map((cycle) => (
          <DropdownMenuItem
            key={cycle}
            disabled={isPending}
            onClick={() => mark(cycle)}
          >
            {SUBSCRIPTION_CYCLE_LABELS[cycle]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
