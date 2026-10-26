"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MailPlus } from "lucide-react";
import { createInbox } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useDashboardI18n } from "@/components/dashboard/dashboard-i18n";

export function CreateInboxButton() {
  const { t } = useDashboardI18n();
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();

  function handleClick() {
    setErrorMessage(null);
    startTransition(async () => {
      const result = await createInbox();
      if (!result.ok) {
        setErrorMessage(result.error);
        toast.error(result.error);
        return;
      }
      setDone(true);
      toast.success(
        result.alreadyExisted
          ? t.forwarding.alreadyHave
          : t.forwarding.created.replace("{email}", result.email),
      );
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button size="sm" onClick={handleClick} disabled={isPending || done}>
        {isPending ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <MailPlus data-icon="inline-start" />
        )}
        {isPending ? t.forwarding.creating : t.forwarding.create}
      </Button>
      {errorMessage ? (
        <p role="alert" className="text-[13px] text-destructive">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
