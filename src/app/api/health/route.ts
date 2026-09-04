import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

// Pinged by an external uptime monitor (see docs/third-party-services.md) to
// keep the Supabase free-tier project from auto-pausing after 7 days of
// inactivity. The ping only counts if it makes a real Supabase API call —
// hitting this route alone does nothing for Supabase unless it queries the
// database, so this must not be simplified into a static 200 response.
export async function GET() {
  const supabase = createServiceClient();
  const { error } = await supabase.from("profiles").select("id").limit(1);

  if (error) {
    console.error("Health check failed to reach Supabase", error);
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
