"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Trash2, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { validateUploadFile } from "@/lib/validation/upload";

type PendingFile = {
  id: string;
  file: File;
};

type UploadOutcome =
  | { ok: true; vendor: string | null; fileName: string }
  | { ok: false; fileName: string; error: string };

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
      ok.length === 1 ? `Extracted 1 invoice` : `Extracted ${ok.length} invoices`,
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
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(
    null,
  );
  const router = useRouter();
  const isUploading = progress !== null;

  function handleOpenChange(next: boolean) {
    if (!next && isUploading) return;
    if (!next) setPending([]);
    setOpen(next);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    const next: PendingFile[] = [];
    for (const file of files) {
      const validated = validateUploadFile({
        type: file.type || "application/octet-stream",
        size: file.size,
      });
      if (!validated.success) {
        toast.error(`${file.name}: ${validated.error}`);
        continue;
      }
      next.push({ id: crypto.randomUUID(), file });
    }
    if (next.length === 0) return;

    setPending(next);
    setOpen(true);
  }

  function removePending(id: string) {
    const updated = pending.filter((item) => item.id !== id);
    setPending(updated);
    if (updated.length === 0) setOpen(false);
  }

  async function confirmUpload() {
    if (pending.length === 0 || isUploading) return;

    const files = pending.map((item) => item.file);
    setProgress({ current: 0, total: files.length });
    const outcomes: UploadOutcome[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]!;
        setProgress({ current: i + 1, total: files.length });
        try {
          const outcome = await uploadOne(file);
          outcomes.push(outcome);
          if (!outcome.ok && /too many uploads/i.test(outcome.error)) {
            for (let j = i + 1; j < files.length; j++) {
              outcomes.push({
                ok: false,
                fileName: files[j]!.name,
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
      setPending([]);
      setOpen(false);
    } finally {
      setProgress(null);
    }
  }

  const count = pending.length;
  const confirmLabel = isUploading
    ? progress.total === 1
      ? "Extracting..."
      : `Extracting ${progress.current}/${progress.total}...`
    : count === 1
      ? "Upload & extract"
      : `Upload & extract ${count} files`;

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
        <UploadIcon data-icon="inline-start" />
        Upload invoice
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="sm:max-w-md"
          showCloseButton={!isUploading}
        >
          <DialogHeader>
            <DialogTitle>
              {count === 1 ? "Confirm upload" : `Confirm upload (${count} files)`}
            </DialogTitle>
            <DialogDescription>
              Review the files below. Extraction starts only after you confirm.
            </DialogDescription>
          </DialogHeader>

          <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto">
            {pending.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2"
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(item.file.size)}
                  </p>
                </div>
                {!isUploading ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${item.file.name}`}
                    onClick={() => removePending(item.id)}
                  >
                    <Trash2 />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isUploading}
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isUploading || count === 0}
              onClick={confirmUpload}
            >
              {isUploading ? <Spinner data-icon="inline-start" /> : null}
              {confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
