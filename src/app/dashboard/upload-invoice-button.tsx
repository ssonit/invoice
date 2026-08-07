"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { validateUploadFile } from "@/lib/validation/upload";

type UploadOutcome =
  | { ok: true; vendor: string | null; fileName: string }
  | { ok: false; fileName: string; error: string };

async function uploadOne(file: File): Promise<UploadOutcome> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/invoices/upload", { method: "POST", body: formData });
  let body: { error?: string; invoice?: { vendor?: string | null } };
  try {
    body = await res.json();
  } catch {
    return { ok: false, fileName: file.name, error: "Upload failed" };
  }
  if (!res.ok) {
    return { ok: false, fileName: file.name, error: body.error ?? "Upload failed" };
  }
  return {
    ok: true,
    vendor: body.invoice?.vendor ?? null,
    fileName: file.name,
  };
}

function toastUploadResults(outcomes: UploadOutcome[]) {
  const ok = outcomes.filter((o) => o.ok);
  const fail = outcomes.filter((o) => !o.ok);

  if (ok.length === 1 && fail.length === 0) {
    const only = ok[0]!;
    toast.success(`Extracted invoice from ${only.vendor ?? only.fileName}`);
    return;
  }

  if (ok.length > 0) {
    toast.success(
      ok.length === 1
        ? `Extracted 1 invoice`
        : `Extracted ${ok.length} invoices`,
    );
  }
  if (fail.length > 0) {
    const first = fail[0]!;
    toast.error(
      fail.length === 1
        ? `${first.fileName}: ${first.error}`
        : `${fail.length} uploads failed — first: ${first.fileName}: ${first.error}`,
    );
  }
}

export function UploadInvoiceButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(
    null,
  );
  const router = useRouter();
  const isUploading = progress !== null;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    const toUpload: File[] = [];
    for (const file of files) {
      const validated = validateUploadFile({
        type: file.type || "application/octet-stream",
        size: file.size,
      });
      if (!validated.success) {
        toast.error(`${file.name}: ${validated.error}`);
        continue;
      }
      toUpload.push(file);
    }
    if (toUpload.length === 0) return;

    setProgress({ current: 0, total: toUpload.length });
    const outcomes: UploadOutcome[] = [];
    try {
      for (let i = 0; i < toUpload.length; i++) {
        const file = toUpload[i]!;
        setProgress({ current: i + 1, total: toUpload.length });
        try {
          const outcome = await uploadOne(file);
          outcomes.push(outcome);
          if (!outcome.ok && /too many uploads/i.test(outcome.error)) {
            for (let j = i + 1; j < toUpload.length; j++) {
              outcomes.push({
                ok: false,
                fileName: toUpload[j]!.name,
                error: "Skipped — rate limited",
              });
            }
            break;
          }
        } catch {
          outcomes.push({
            ok: false,
            fileName: file.name,
            error: "Upload failed — check your connection and try again",
          });
        }
      }

      toastUploadResults(outcomes);
      if (outcomes.some((o) => o.ok)) {
        router.refresh();
      }
    } finally {
      setProgress(null);
    }
  }

  const label = isUploading
    ? progress.total === 1
      ? "Extracting..."
      : `Extracting ${progress.current}/${progress.total}...`
    : "Upload invoice";

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="application/pdf,image/png,image/jpeg,image/webp,image/gif"
        className="sr-only"
        onChange={handleFileChange}
      />
      <Button onClick={() => inputRef.current?.click()} disabled={isUploading}>
        {isUploading ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <UploadIcon data-icon="inline-start" />
        )}
        {label}
      </Button>
    </>
  );
}
