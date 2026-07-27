"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { createCheckoutUrl } from "@/app/dashboard/actions";
import { hasActiveTeamPlan, type BillingSubscriptionRow } from "@/lib/billing";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatInvoiceDate } from "@/lib/invoices";

export function BillingCard({ subscription }: { subscription: BillingSubscriptionRow }) {
  const [isPending, startTransition] = useTransition();
  const isTeam = hasActiveTeamPlan(subscription);

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
        {subscription.status === "cancelled" && subscription.ends_at ? (
          <Badge variant="secondary">Ends {formatInvoiceDate(subscription.ends_at)}</Badge>
        ) : null}
      </div>

      {isTeam ? (
        // Button wraps @base-ui/react/button, which uses a `render` prop for
        // polymorphism, not Radix's `asChild` — a plain anchor styled with
        // buttonVariants() avoids depending on that (untested here) merge
        // behavior for something this simple.
        <a
          href={subscription.customer_portal_url ?? "#"}
          target="_blank"
          rel="noreferrer"
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
