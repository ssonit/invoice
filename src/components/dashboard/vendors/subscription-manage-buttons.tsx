"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, RotateCcw, Tag } from "lucide-react";
import { SUBSCRIPTION_CONFIRMATION_STATUS } from "@/constants/subscriptions";
import { confirmSubscription, unmarkVendorSubscription } from "@/app/dashboard/vendors/actions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useDashboardI18n } from "@/components/dashboard/dashboard-i18n";

type ManageAction = "cancel" | "reactivate" | "unmark";

// Lets the user end a subscription's tracking: cancel it, bring a cancelled one
// back, or stop tracking the vendor as a subscription altogether.
export function SubscriptionManageButtons({
  vendorKey,
  isCancelled,
}: {
  vendorKey: string;
  isCancelled: boolean;
}) {
  const { t } = useDashboardI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<ManageAction | null>(null);

  function run(action: ManageAction) {
    setPendingAction(action);
    startTransition(async () => {
      const result =
        action === "unmark"
          ? await unmarkVendorSubscription(vendorKey)
          : await confirmSubscription(
              vendorKey,
              action === "cancel"
                ? SUBSCRIPTION_CONFIRMATION_STATUS.CANCELLED
                : SUBSCRIPTION_CONFIRMATION_STATUS.ACTIVE,
            );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        action === "cancel"
          ? t.vendors.markedCancelled
          : action === "reactivate"
            ? t.vendors.reactivated
            : t.vendors.unmarked,
      );
      router.refresh();
    });
  }

  function icon(action: ManageAction, fallback: React.ReactNode) {
    return isPending && pendingAction === action ? <Spinner data-icon="inline-start" /> : fallback;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isCancelled ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => run("reactivate")}
        >
          {icon("reactivate", <RotateCcw data-icon="inline-start" />)}
          {t.vendors.reactivateSubscription}
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => run("cancel")}
        >
          {icon("cancel", <Ban data-icon="inline-start" />)}
          {t.vendors.cancelSubscription}
        </Button>
      )}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={isPending}
        onClick={() => run("unmark")}
      >
        {icon("unmark", <Tag data-icon="inline-start" />)}
        {t.vendors.unmarkSubscription}
      </Button>
    </div>
  );
}
