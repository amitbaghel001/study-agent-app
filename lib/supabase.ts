import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Browser-safe / public-read Supabase client. Uses the anon key, which is safe
 * to ship to the browser — its access is restricted by your table's RLS
 * policies.
 *
 * Use this from client components and for reads that should respect RLS.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase public environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment.",
    );
  }

  return createSupabaseClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Server-only Supabase client. Uses the service role key, which bypasses RLS
 * and has full admin access. NEVER expose this client or the service role key
 * to the browser — keep SUPABASE_SERVICE_ROLE_KEY out of any NEXT_PUBLIC_
 * variable and only read it from server-side code (Route Handlers, Server
 * Components, Server Actions).
 *
 * Use this for trusted server-side reads and writes that need to bypass RLS,
 * such as system writes triggered by background jobs or server logic.
 */
export function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable.");
  }
  if (!serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY environment variable. Add it to your server-side environment (never prefix with NEXT_PUBLIC_) and restart the dev server.",
    );
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
