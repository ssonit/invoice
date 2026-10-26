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

export function DeleteInboxButton({ forwardAddress }: { forwardAddress: string }) {
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
      toast.success("Forwarding address deleted.");
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
        Delete address
      </Button>

      <AlertDialog open={isOpen} onOpenChange={(next) => !isPending && setIsOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this forwarding address?</AlertDialogTitle>
            <AlertDialogDescription>
              {forwardAddress} will stop receiving email and can&apos;t be restored — emails
              your agent sends to it afterwards will bounce. Invoices already extracted stay
              in your account. You can create a new address afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {errorMessage ? (
            <p role="alert" className="text-[13px] text-destructive">
              {errorMessage}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isPending}
              onClick={(e) => {
                e.preventDefault();
                handleConfirm();
              }}
            >
              {isPending ? <Spinner data-icon="inline-start" /> : null}
              Delete address
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
