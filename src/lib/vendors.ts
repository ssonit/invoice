import { normalizeVendorKey } from "@/lib/subscriptions";

type Upsertable = {
  from: (table: string) => {
    upsert: (
      values: Record<string, unknown>,
      options: { onConflict: string; ignoreDuplicates?: boolean },
    ) => PromiseLike<{ error: { message: string } | null }>;
  };
};

/** Ensure a vendor row exists for the given display name. No-op if blank. */
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
