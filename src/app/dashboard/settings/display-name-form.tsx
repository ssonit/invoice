"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateDisplayName } from "../actions";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useDashboardI18n } from "@/components/dashboard/dashboard-i18n";
import { NAME_MAX_LENGTH } from "@/constants/validation";

export function DisplayNameForm({ initialName }: { initialName: string }) {
  const { t } = useDashboardI18n();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateDisplayName(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(t.settings.nameSaved);
    });
  }

  return (
    <form action={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="display-name">{t.settings.nameLabel}</FieldLabel>
          <Input
            id="display-name"
            name="name"
            defaultValue={initialName}
            required
            maxLength={NAME_MAX_LENGTH}
            autoComplete="name"
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
          {isPending ? t.settings.savingName : t.settings.saveName}
        </Button>
      </FieldGroup>
    </form>
  );
}
