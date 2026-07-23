"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { validateUploadFile } from "@/lib/validation/upload";

export function UploadInvoiceButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const router = useRouter();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const validated = validateUploadFile({
      type: file.type || "application/octet-stream",
      size: file.size,
    });
    if (!validated.success) {
      toast.error(validated.error);
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/invoices/upload", { method: "POST", body: formData });
      const body = await res.json();

      if (!res.ok) {
        toast.error(body.error ?? "Upload failed");
        return;
      }

      toast.success(`Extracted invoice from ${body.invoice.vendor ?? file.name}`);
      router.refresh();
    } catch {
      toast.error("Upload failed — check your connection and try again");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
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
        {isUploading ? "Extracting..." : "Upload invoice"}
      </Button>
    </>
  );
}
