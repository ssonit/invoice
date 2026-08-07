import { normalizeVendorKey } from "@/lib/subscriptions";

type Upsertable = {
  from: (table: string) => {
    upsert: (
      values: Record<string, unknown>,
      options: { onConflict: string; ignoreDuplicates?: boolean },
    ) => PromiseLike<{ error: { message: string } | null }>;
  };
};

/** Ensure a vendor row exists for the given display name. No-op if blank.
 *
 *  Deliberately does NOT revive a vendor the user soft-deleted: `ignoreDuplicates`
 *  makes this ON CONFLICT DO NOTHING, so a new invoice from a deleted vendor
 *  keeps its `vendor` string (and still counts in analytics) without putting the
 *  vendor back in the user's curated list. Deletion is an explicit user action;
 *  only an equally explicit one — re-creating the vendor by name, see
 *  createVendor() — brings it back. Don't "fix" this into an upsert that clears
 *  `deleted_at`. */
export async function ensureVendorRecord(
  client: Upsertable,
  userId: string,
  vendorName: string | null | undefined,
): Promise<void> {
  if (!vendorName) return;
  const name = vendorName.trim();
  if (!name) return;

  const { error } = await client.from("vendors").upsert(
    {
      user_id: userId,
      name,
      name_key: normalizeVendorKey(name),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,name_key", ignoreDuplicates: true },
  );

  if (error) {
    console.error("Failed to ensure vendor record", userId, error);
  }
}
