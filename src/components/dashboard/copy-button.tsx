"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useDashboardI18n } from "@/components/dashboard/dashboard-i18n";

export function CopyButton({
  value,
  label,
  copiedLabel,
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
}) {
  const { t } = useDashboardI18n();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch (error) {
      // Clipboard API is unavailable outside secure contexts and can be
      // permission-denied — the value stays on screen to copy by hand.
      console.error("Failed to copy value to clipboard", error);
      toast.error(t.common.copyFailed);
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleCopy}>
      {copied ? (
        <CheckIcon data-icon="inline-start" />
      ) : (
        <CopyIcon data-icon="inline-start" />
      )}
      {copied ? (copiedLabel ?? t.common.copied) : (label ?? t.common.copy)}
    </Button>
  );
}
