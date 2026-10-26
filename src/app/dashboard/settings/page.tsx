import { createClient } from "@/lib/supabase/server";
import { ContentShell } from "@/components/dashboard/content-shell";
import { CopyButton } from "@/components/dashboard/copy-button";
import { CreateInboxButton } from "@/components/dashboard/create-inbox-button";
import { ChangePasswordForm } from "./change-password-form";
import { DisplayNameForm } from "./display-name-form";
import { getDashboardDictionary } from "@/lib/dashboard/locale-server";
import { DeleteAccountSection } from "./delete-account-section";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import { isEmailIntakeConfigured } from "@/lib/email-intake";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { t } = await getDashboardDictionary();
  const displayName =
    typeof user!.user_metadata?.display_name === "string"
      ? user!.user_metadata.display_name.trim()
      : "";

  const isEmailIntakeEnabled = isEmailIntakeConfigured(process.env);
  const { data: inbox } = isEmailIntakeEnabled
    ? await supabase
        .from("inboxes")
        .select("email_address")
        .eq("user_id", user!.id)
        .is("deleted_at", null)
        .maybeSingle()
    : { data: null };

  return (
    <ContentShell
      title={t.settings.title}
      description={
        isEmailIntakeEnabled
          ? t.settings.descriptionWithEmail
          : t.settings.descriptionNoEmail
      }
    >
      <div className="flex flex-col gap-4">
        <Card className="rounded-[14px] shadow-none">
          <CardHeader>
            <CardTitle className="text-[13px] font-semibold">{t.settings.profileTitle}</CardTitle>
            <CardDescription className="text-[13px]">
              {t.settings.profileDescription}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DisplayNameForm initialName={displayName} />
          </CardContent>
        </Card>

        {isEmailIntakeEnabled ? (
          <Card className="rounded-[14px] shadow-none">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle className="text-[13px] font-semibold">{t.settings.forwardingTitle}</CardTitle>
                {inbox ? (
                  <Badge
                    variant="outline"
                    className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                  >
                    <CheckCircle2 className="size-3" />
                    {t.settings.active}
                  </Badge>
                ) : null}
              </div>
              <CardDescription className="text-[13px]">
                {t.settings.forwardingHelp}
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
                    {t.settings.forwardingPermanent}
                  </p>
                </div>
              ) : (
                <CreateInboxButton />
              )}
            </CardContent>
          </Card>
        ) : null}

        <Card className="rounded-[14px] shadow-none">
          <CardHeader>
            <CardTitle className="text-[13px] font-semibold">{t.settings.passwordTitle}</CardTitle>
            <CardDescription className="text-[13px]">
              {t.settings.passwordDescription}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>

        <Card className="rounded-[14px] border-destructive/30 shadow-none">
          <CardHeader>
            <CardTitle className="text-[13px] font-semibold text-destructive">
              {t.settings.dangerZone}
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
