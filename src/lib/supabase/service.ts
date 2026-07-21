import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Bypasses RLS via the service_role key. Server-only: never import this
// from a Client Component or anything bundled to the browser.
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
