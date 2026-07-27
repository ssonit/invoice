"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteAccount } from "../actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Trash2 } from "lucide-react";

export function DeleteAccountSection({ email }: { email: string }) {
  const [confirmEmail, setConfirmEmail] = useState("");
  const [isPending, startTransition] = useTransition();

  const canDelete = confirmEmail.trim().toLowerCase() === email.toLowerCase();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteAccount(confirmEmail);
      if (!result.ok) {
        toast.error(result.error);
      }
      // On success the action redirects — nothing else to do here.
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-muted-foreground">
        This deactivates your account and signs you out — you will not be able to sign
        back in. Your invoices and other data are kept, not erased. Type{" "}
        <span className="font-mono">{email}</span> to confirm.
      </p>
      <Input
        value={confirmEmail}
        onChange={(e) => setConfirmEmail(e.target.value)}
        placeholder={email}
        className="h-9 max-w-sm"
        aria-label="Confirm your email to delete your account"
      />
      <Button
        variant="destructive"
        size="sm"
        className="w-fit"
        disabled={!canDelete || isPending}
        onClick={handleDelete}
      >
        {isPending ? <Spinner data-icon="inline-start" /> : <Trash2 data-icon="inline-start" />}
        {isPending ? "Deleting..." : "Delete account"}
      </Button>
    </div>
  );
}
