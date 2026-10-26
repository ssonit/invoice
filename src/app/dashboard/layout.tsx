import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { SiteHeader } from "@/components/dashboard/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { isEmailIntakeConfigured } from "@/lib/email-intake";
import { DashboardI18nProvider } from "@/components/dashboard/dashboard-i18n";
import { getDashboardLocale } from "@/lib/dashboard/locale-server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const email = user.email ?? "account";
  const displayName =
    typeof user.user_metadata?.display_name === "string" ? user.user_metadata.display_name.trim() : "";

  const locale = await getDashboardLocale();

  return (
    <DashboardI18nProvider initialLocale={locale}>
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar isEmailIntakeEnabled={isEmailIntakeConfigured(process.env)} />
        <SidebarInset>
          <SiteHeader email={email} displayName={displayName} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
    </DashboardI18nProvider>
  );
}
