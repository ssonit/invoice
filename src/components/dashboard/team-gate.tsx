"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { createCheckoutUrl } from "@/app/dashboard/actions";
import { ContentShell } from "@/components/dashboard/content-shell";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface TeamGateProps {
  title: string;
  description: string;
}

/**
 * Full-page upgrade CTA shown when a Starter user hits a Team-gated route.
 * Not a 404 — the path stays the same so the user knows where they'll land
 * after upgrading.
 */
export function TeamGate({ title, description }: TeamGateProps) {
  const [isPending, startTransition] = useTransition();

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
    <ContentShell title={title} description={description}>
      <div className="flex flex-col items-center justify-center gap-4 rounded-[14px] border border-border bg-card px-6 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-[15px] font-semibold text-foreground">
            Upgrade to Team
          </h2>
          <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">
            Analytics and exports are available on the Team plan. Upgrade to
            unlock advanced reporting and CSV downloads for your workspace.
          </p>
        </div>
        <Button
          size="sm"
          className="mt-1 w-fit"
          disabled={isPending}
          onClick={handleUpgrade}
        >
          {isPending ? <Spinner data-icon="inline-start" /> : null}
          {isPending ? "Redirecting..." : "Upgrade to Team"}
        </Button>
      </div>
    </ContentShell>
  );
}
