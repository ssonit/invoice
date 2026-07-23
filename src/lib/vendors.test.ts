import { describe, expect, it, vi } from "vitest";
import { ensureVendorRecord } from "./vendors";

function mockClient(error: { message: string } | null = null) {
  const upsert = vi.fn().mockResolvedValue({ error });
  const from = vi.fn().mockReturnValue({ upsert });
  return { client: { from }, from, upsert };
}

describe("ensureVendorRecord", () => {
  it("upserts on (user_id, name_key) with ignoreDuplicates", async () => {
    const { client, from, upsert } = mockClient();
    await ensureVendorRecord(client, "user-1", "Acme SaaS");
    expect(from).toHaveBeenCalledWith("vendors");
    const [row, options] = upsert.mock.calls[0]!;
    expect(row).toMatchObject({ user_id: "user-1", name: "Acme SaaS", name_key: "acme saas" });
    expect(options).toEqual({ onConflict: "user_id,name_key", ignoreDuplicates: true });
  });

  it("trims the name before storing it", async () => {
    const { client, upsert } = mockClient();
    await ensureVendorRecord(client, "user-1", "  Acme  ");
    expect(upsert.mock.calls[0]![0]).toMatchObject({ name: "Acme" });
  });

  it("is a no-op for null, undefined, or blank vendor names", async () => {
    const { client, from } = mockClient();
    await ensureVendorRecord(client, "user-1", null);
    await ensureVendorRecord(client, "user-1", undefined);
    await ensureVendorRecord(client, "user-1", "   ");
    expect(from).not.toHaveBeenCalled();
  });

  it("does not throw when the upsert returns an error", async () => {
    const { client } = mockClient({ message: "boom" });
    await expect(ensureVendorRecord(client, "user-1", "Acme")).resolves.toBeUndefined();
  });
});
