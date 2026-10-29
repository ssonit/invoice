import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { mimeTypeFromPath } from "@/lib/invoices/file-type";
import { parseRetryExtractionInput } from "@/lib/validation/invoices";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401, headers: PRIVATE_HEADERS });

  const parsed = parseRetryExtractionInput(await params);
  if (!parsed.success) return Response.json({ error: "Invalid invoice id" }, { status: 400, headers: PRIVATE_HEADERS });

  // Verify ownership through the user's client before accessing the private bucket.
  const { data: invoice, error } = await supabase.from("invoices")
    .select("file_url")
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return Response.json({ error: "Could not load invoice" }, { status: 500, headers: PRIVATE_HEADERS });
  const mimeType = invoice?.file_url ? mimeTypeFromPath(invoice.file_url) : null;
  if (!invoice?.file_url || !mimeType) return Response.json({ error: "Original file not found" }, { status: 404, headers: PRIVATE_HEADERS });

  const service = createServiceClient();
  const { data: file, error: fileError } = await service.storage.from("invoice-files").download(invoice.file_url);
  if (fileError || !file) return Response.json({ error: "Original file unavailable" }, { status: 404, headers: PRIVATE_HEADERS });

  const disposition = new URL(request.url).searchParams.get("download") === "1" ? "attachment" : "inline";
  const extension = mimeType === "application/pdf" ? "pdf" : mimeType.slice("image/".length);
  return new Response(file, { headers: {
    ...PRIVATE_HEADERS,
    "Content-Type": mimeType,
    "Content-Disposition": `${disposition}; filename="invoice-${parsed.data.id}.${extension}"`,
    "Content-Length": String(file.size),
    "X-Frame-Options": "SAMEORIGIN",
  } });
}
