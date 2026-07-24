"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { changePassword } from "../actions";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function ChangePasswordForm() {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await changePassword(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Password updated.");
      formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} action={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="password">New password</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            className="h-9"
          />
        </Field>
        {error ? (
          <p role="alert" className="text-[12px] text-destructive">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="sm" disabled={isPending} className="w-fit">
          {isPending ? <Spinner data-icon="inline-start" /> : null}
          {isPending ? "Updating..." : "Update password"}
        </Button>
      </FieldGroup>
    </form>
  );
}
