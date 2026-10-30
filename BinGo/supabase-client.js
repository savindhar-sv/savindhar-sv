import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

let clientPromise;

export function getSupabaseClient() {
  if (!clientPromise) {
    clientPromise = (async () => {
      const { createClient } = await import(
        "https://esm.sh/@supabase/supabase-js@2.118.0"
      );
      return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false
        }
      });
    })();
  }
  return clientPromise;
}
