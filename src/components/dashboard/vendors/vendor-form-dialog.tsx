"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus } from "lucide-react"

import { createVendor, updateVendor } from "@/app/dashboard/vendors/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { useDashboardI18n } from "@/components/dashboard/dashboard-i18n"

type VendorFormValues = {
  id?: string
  name: string
  notes: string
}

export function AddVendorButton() {
  const { t } = useDashboardI18n()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus data-icon="inline-start" />
        {t.vendors.addVendor}
      </Button>
      <VendorFormDialog
        open={open}
        onOpenChange={setOpen}
        title={t.vendors.addVendor}
        description={t.vendors.addDescription}
        submitLabel={t.vendors.create}
        initial={{ name: "", notes: "" }}
      />
    </>
  )
}

export function VendorFormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  initial,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  submitLabel: string
  initial: VendorFormValues
}) {
  const { t } = useDashboardI18n()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState(initial.name)
  const [notes, setNotes] = useState(initial.notes)

  function handleOpenChange(next: boolean) {
    if (!next) {
      setName(initial.name)
      setNotes(initial.notes)
    } else {
      setName(initial.name)
      setNotes(initial.notes)
    }
    onOpenChange(next)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = initial.id
        ? await updateVendor({ id: initial.id, name, notes })
        : await createVendor({ name, notes })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(initial.id ? t.vendors.vendorUpdated : t.vendors.vendorCreated)
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <FieldGroup>
            <Field data-invalid={!name.trim() || undefined}>
              <FieldLabel htmlFor="vendor-name">{t.vendors.name}</FieldLabel>
              <Input
                id="vendor-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.vendors.namePlaceholder}
                required
                maxLength={200}
                disabled={isPending}
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="vendor-notes">{t.vendors.notesOptional}</FieldLabel>
              <Input
                id="vendor-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t.vendors.notesPlaceholder}
                maxLength={1000}
                disabled={isPending}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => handleOpenChange(false)}
            >
              {t.vendors.cancel}
            </Button>
            <Button type="submit" disabled={isPending || !name.trim()}>
              {isPending ? <Spinner data-icon="inline-start" /> : null}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
