import type { createServiceClient } from "@/lib/supabase/service";
import { getInvoiceIdentity } from "@/lib/invoices/identity";

type ServiceClient = ReturnType<typeof createServiceClient>;

/**
 * Finds an invoice this user already has with the same vendor and invoice
 * number — a different file of the same invoice (invoice PDF vs receipt image).
 * Bumps its duplicate_hit_count and returns it, or null when it is new.
 */
export async function findAndCountSameInvoice(params: {
  supabase: ServiceClient;
  userId: string;
  extracted: { vendor: string | null; invoice_number: string | null };
}) {
  const { supabase, userId, extracted } = params;
  const identity = getInvoiceIdentity(extracted);
  if (!identity) return null;

  const { data: existing, error } = await supabase
    .from("invoices")
    .select()
    .eq("user_id", userId)
    .is("deleted_at", null)
    .eq("vendor_key", identity.vendorKey)
    .eq("invoice_number", identity.invoiceNumber)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("Failed to look up invoice by number", userId, error);
    return null;
  }
  if (!existing) return null;

  const { error: hitError } = await supabase
    .from("invoices")
    .update({ duplicate_hit_count: (existing.duplicate_hit_count ?? 0) + 1 })
    .eq("id", existing.id);
  if (hitError) {
    console.error("Failed to record duplicate invoice hit", userId, hitError);
  }
  return existing;
}
