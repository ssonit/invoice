"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MailPlus } from "lucide-react";
import { createInbox } from "../actions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function CreateInboxButton() {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      const result = await createInbox();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setDone(true);
      toast.success(
        result.alreadyExisted
          ? "You already have a forwarding address."
          : `Forwarding address created: ${result.email}`,
      );
      router.refresh();
    });
  }

  return (
    <Button size="sm" onClick={handleClick} disabled={isPending || done}>
      {isPending ? (
        <Spinner data-icon="inline-start" />
      ) : (
        <MailPlus data-icon="inline-start" />
      )}
      {isPending ? "Creating..." : "Create forwarding address"}
    </Button>
  );
}
