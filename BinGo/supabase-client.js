let clientPromise;

export function getSupabaseClient() {
  if (!clientPromise) {
    clientPromise = (async () => {
      const response = await fetch("/api/config", { cache: "no-store" });
      const config = await response.json();
      if (!response.ok) {
        throw new Error(config.error || "Supabase is not configured.");
      }

      const { createClient } = await import(
        "https://esm.sh/@supabase/supabase-js@2.118.0"
      );
      return createClient(config.supabase_url, config.publishable_key, {
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
