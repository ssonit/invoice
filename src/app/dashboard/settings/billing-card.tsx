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
}: {
  subscription: BillingSubscriptionRow;
  justCheckedOut?: boolean;
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
  // Whether to send the user to their existing subscription's Lemon Squeezy
  // portal (to fix/manage it) vs. start a brand-new checkout. Deliberately
  // NOT the same check as isTeam/hasActiveTeamPlan — a paused or unpaid
  // subscriber has lost access (isTeam is false) but already has a real
  // subscription and should be routed to fix it, not sold a duplicate.
  const hasExistingSubscription = subscription.status !== "none";

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
