import { createClient } from "@/lib/supabase/server";
import { ContentShell } from "@/components/dashboard/content-shell";
import { CopyButton } from "@/components/dashboard/copy-button";
import { CreateInboxButton } from "@/components/dashboard/create-inbox-button";
import { ChangePasswordForm } from "./change-password-form";
import { DeleteAccountSection } from "./delete-account-section";
import { BillingCard } from "./billing-card";
import type { BillingSubscriptionRow } from "@/lib/billing";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const rawParams = await searchParams;
  const justCheckedOut = rawParams.checkout === "success";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: inbox }, { data: subscription, error: subscriptionError }] = await Promise.all([
    supabase.from("inboxes").select("email_address").eq("user_id", user!.id).maybeSingle(),
    supabase
      .from("billing_subscriptions")
      .select("plan, status, customer_portal_url, renews_at, ends_at")
      .eq("user_id", user!.id)
      .single<BillingSubscriptionRow>(),
  ]);

  if (subscriptionError) {
    console.error("Failed to load billing subscription", user!.id, subscriptionError);
  }

  return (
    <ContentShell
      title="Settings"
      description="Set up email forwarding so invoices land in your dashboard automatically."
    >
      <div className="flex flex-col gap-4">
        <Card className="rounded-[14px] shadow-none">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="text-[13px] font-semibold">Forwarding address</CardTitle>
              {inbox ? (
                <Badge
                  variant="outline"
                  className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                >
                  <CheckCircle2 className="size-3" />
                  Active
                </Badge>
              ) : null}
            </div>
            <CardDescription className="text-[13px]">
              Forward invoice emails to this address, or set up an auto-forward rule in
              Gmail/Outlook. Anything that arrives is parsed and added to your invoices.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {inbox ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <code className="rounded-[8px] bg-muted px-3 py-1.5 font-mono text-[13px]">
                    {inbox.email_address}
                  </code>
                  <CopyButton value={inbox.email_address} />
                </div>
                <p className="text-[12px] text-muted-foreground">
                  This is your permanent forwarding address — you only get one per account.
                </p>
              </div>
            ) : (
              <CreateInboxButton />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[14px] shadow-none">
          <CardHeader>
            <CardTitle className="text-[13px] font-semibold">Billing</CardTitle>
            <CardDescription className="text-[13px]">
              Manage your plan and payment method.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {subscription ? (
              <BillingCard subscription={subscription} justCheckedOut={justCheckedOut} />
            ) : (
              <p className="text-[13px] text-muted-foreground">
                Could not load your billing status. Please refresh the page.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[14px] shadow-none">
          <CardHeader>
            <CardTitle className="text-[13px] font-semibold">Password</CardTitle>
            <CardDescription className="text-[13px]">
              Update the password you use to sign in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>

        <Card className="rounded-[14px] border-destructive/30 shadow-none">
          <CardHeader>
            <CardTitle className="text-[13px] font-semibold text-destructive">
              Danger zone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DeleteAccountSection email={user!.email!} />
          </CardContent>
        </Card>
      </div>
    </ContentShell>
  );
}
