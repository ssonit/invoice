"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { deleteInbox } from "@/app/dashboard/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useDashboardI18n } from "@/components/dashboard/dashboard-i18n";

export function DeleteInboxButton({ forwardAddress }: { forwardAddress: string }) {
  const { t } = useDashboardI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();

  function handleConfirm() {
    setErrorMessage(null);
    startTransition(async () => {
      const result = await deleteInbox();
      if (!result.ok) {
        setErrorMessage(result.error);
        toast.error(result.error);
        return;
      }
      setIsOpen(false);
      toast.success(t.forwarding.deleted);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={() => setIsOpen(true)}
      >
        <Trash2 data-icon="inline-start" />
        {t.forwarding.deleteButton}
      </Button>

      <AlertDialog open={isOpen} onOpenChange={(next) => !isPending && setIsOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.forwarding.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.forwarding.deleteDescription.replace("{address}", forwardAddress)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {errorMessage ? (
            <p role="alert" className="text-[13px] text-destructive">
              {errorMessage}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>{t.forwarding.cancel}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isPending}
              onClick={(e) => {
                e.preventDefault();
                handleConfirm();
              }}
            >
              {isPending ? <Spinner data-icon="inline-start" /> : null}
              {t.forwarding.deleteButton}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
