"use client";

import { useEffect, useTransition } from "react";
import { toast } from "sonner";
import { createCheckoutUrl } from "@/app/dashboard/actions";
import {
  hasActiveTeamPlan,
  isBillingDevUnlockEnabled,
  type BillingSubscriptionRow,
} from "@/lib/billing";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatInvoiceDate } from "@/lib/invoices";

export function BillingCard({
  subscription,
  justCheckedOut,
  usage,
}: {
  subscription: BillingSubscriptionRow;
  justCheckedOut?: boolean;
  usage?: { used: number; limit: number; resetsAt: string } | null;
}) {
  const [isPending, startTransition] = useTransition();
  const isTeam = hasActiveTeamPlan(subscription);
  const devUnlock = isBillingDevUnlockEnabled();

  useEffect(() => {
    if (justCheckedOut) {
      toast.info(
        "Processing your payment — this page will update automatically once it's confirmed.",
      );
    }
  }, [justCheckedOut]);

  const hasExistingSubscription = subscription.status !== "none";

  const usageRatio = usage ? usage.used / usage.limit : 0;
  const showSoftWarn = usageRatio >= 0.8 && usageRatio < 1;
  const showBlocked = usageRatio >= 1;

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
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[13px] text-muted-foreground">
          {isTeam ? "You're on the Team plan." : "You're on the free Starter plan."}
        </p>
        {subscription.status === "past_due" ? (
          <Badge variant="destructive">Payment failed — please update your card</Badge>
        ) : null}
        {subscription.status === "unpaid" ? (
          <Badge variant="destructive">Subscription unpaid — please update your card</Badge>
        ) : null}
        {subscription.status === "paused" ? (
          <Badge variant="secondary">Subscription paused</Badge>
        ) : null}
        {subscription.status === "cancelled" && subscription.ends_at ? (
          <Badge variant="secondary">Ends {formatInvoiceDate(subscription.ends_at)}</Badge>
        ) : null}
        {devUnlock ? (
          <Badge variant="outline" className="text-muted-foreground">
            Dev unlock on
          </Badge>
        ) : null}
      </div>

      {/* Usage meter — Starter only (Team has no cap) */}
      {!isTeam && usage ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${
                  showBlocked
                    ? "bg-destructive"
                    : showSoftWarn
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(usageRatio * 100, 100)}%` }}
              />
            </div>
            <span className="text-[12px] tabular-nums text-muted-foreground">
              {usage.used}/{usage.limit}
            </span>
          </div>
          <p className="text-[12px] text-muted-foreground">
            {showBlocked
              ? `Monthly limit reached. Resets ${formatInvoiceDate(usage.resetsAt)}.`
              : showSoftWarn
                ? `Almost at your monthly limit. Resets ${formatInvoiceDate(usage.resetsAt)}.`
                : `${usage.used} of ${usage.limit} invoices this month · resets ${formatInvoiceDate(usage.resetsAt)}`}
          </p>
        </div>
      ) : null}

      {hasExistingSubscription ? (
        <a
          href={subscription.customer_portal_url ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "outline", size: "sm", className: "w-fit" })}
        >
          Manage subscription
        </a>
      ) : (
        <Button size="sm" className="w-fit" disabled={isPending} onClick={handleUpgrade}>
          {isPending ? <Spinner data-icon="inline-start" /> : null}
          {isPending ? "Redirecting..." : "Upgrade to Team"}
        </Button>
      )}
    </div>
  );
}
