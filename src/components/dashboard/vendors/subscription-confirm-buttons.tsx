"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import {
  SUBSCRIPTION_CONFIRMATION_STATUS,
  type SubscriptionConfirmationStatus,
} from "@/constants/subscriptions";
import { confirmSubscription } from "@/app/dashboard/vendors/actions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function SubscriptionConfirmButtons({ vendorKey }: { vendorKey: string }) {
  const [isPending, startTransition] = useTransition();
  const [pendingStatus, setPendingStatus] = useState<SubscriptionConfirmationStatus | null>(
    null,
  );
  const router = useRouter();

  function answer(status: SubscriptionConfirmationStatus) {
    setPendingStatus(status);
    startTransition(async () => {
      const result = await confirmSubscription(vendorKey, status);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        status === SUBSCRIPTION_CONFIRMATION_STATUS.ACTIVE
          ? "Got it — we'll ask again next cycle."
          : "Marked as cancelled.",
      );
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        className="bg-[#E8FF47] text-[#0a0a0a] hover:bg-[#E8FF47]/90"
        disabled={isPending}
        onClick={() => answer(SUBSCRIPTION_CONFIRMATION_STATUS.ACTIVE)}
      >
        {isPending && pendingStatus === SUBSCRIPTION_CONFIRMATION_STATUS.ACTIVE ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <Check data-icon="inline-start" />
        )}
        Still using it
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() => answer(SUBSCRIPTION_CONFIRMATION_STATUS.CANCELLED)}
      >
        {isPending && pendingStatus === SUBSCRIPTION_CONFIRMATION_STATUS.CANCELLED ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <X data-icon="inline-start" />
        )}
        Cancelled
      </Button>
    </div>
  );
}
