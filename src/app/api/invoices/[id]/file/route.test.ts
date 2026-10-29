import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { GET } from "./route";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

const ID = "3c4f0757-64f7-49b5-ad40-7f18b91dcfd5";
let invoice: Record<string, unknown>;
let storageRequests: string[];
let storageMissing: boolean;
const ORIGINAL = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]);

function request(query = "", id = ID) {
  return GET(new Request(`http://localhost/api/invoices/${id}/file${query}`), { params: Promise.resolve({ id }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  invoice = { id: ID, user_id: "owner", deleted_at: null, file_url: "owner/original.pdf" };
  storageRequests = [];
  storageMissing = false;
  const client = createSupabaseClient("http://files.test", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input) => {
      const url = new URL(String(input));
      if (url.pathname.startsWith("/storage/")) {
        storageRequests.push(url.pathname);
        if (storageMissing) return Response.json({ message: "Missing" }, { status: 404 });
        return new Response(ORIGINAL, { headers: { "content-type": "application/octet-stream" } });
      }
      expect(url.searchParams.get("user_id")).toBe("eq.owner");
      expect(url.searchParams.get("id")).toBe(`eq.${ID}`);
      expect(url.searchParams.get("deleted_at")).toBe("is.null");
      return Response.json(invoice.user_id === "owner" && !invoice.deleted_at ? [invoice] : []);
    } },
  });
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) },
    from: client.from.bind(client),
  } as Awaited<ReturnType<typeof createClient>>);
  vi.mocked(createServiceClient).mockReturnValue(client);
});

describe("private original invoice file", () => {
  it("returns original PDF bytes with private, inline headers", async () => {
    const res = await request();
    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(ORIGINAL);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(res.headers.get("content-disposition")).toContain("inline;");
    expect(storageRequests[0]).toContain("/invoice-files/owner/original.pdf");
  });

  it("uses attachment disposition when downloading", async () => {
    const res = await request("?download=1&path=another-user/secret.pdf");
    expect(res.headers.get("content-disposition")).toBe(`attachment; filename="invoice-${ID}.pdf"`);
    expect(storageRequests[0]).toContain("/owner/original.pdf");
  });

  it("serves images with the stored path's supported MIME type", async () => {
    invoice.file_url = "owner/photo.png";
    expect((await request()).headers.get("content-type")).toBe("image/png");
  });

  it.each(["foreign", "deleted", "no-file", "unsafe-type"])("does not download a %s invoice file", async (kind) => {
    if (kind === "foreign") invoice.user_id = "another-user";
    if (kind === "deleted") invoice.deleted_at = "2026-10-28";
    if (kind === "no-file") invoice.file_url = null;
    if (kind === "unsafe-type") invoice.file_url = "owner/file.html";
    expect((await request()).status).toBe(404);
    expect(createServiceClient).not.toHaveBeenCalled();
    expect(storageRequests).toEqual([]);
  });

  it("requires authentication before accessing storage", async () => {
    vi.mocked(createClient).mockResolvedValueOnce({ auth: { getUser: async () => ({ data: { user: null } }) } } as Awaited<ReturnType<typeof createClient>>);
    expect((await request()).status).toBe(401);
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("rejects malformed invoice IDs", async () => {
    expect((await request("", "not-an-id")).status).toBe(400);
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("returns a private error response if the stored file is missing", async () => {
    storageMissing = true;
    const res = await request();
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });
});
