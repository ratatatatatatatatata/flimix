import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * Cookie-less anon Supabase client — for PUBLIC published-content queries ONLY.
 *
 * Because it carries no per-user state (no cookies, no session), queries made
 * with it are safe to wrap in `unstable_cache` and share across all visitors.
 * NEVER use it for user-specific data (favorites, watch progress, account).
 */
export function createPublicClient(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );
  }
  return client;
}
