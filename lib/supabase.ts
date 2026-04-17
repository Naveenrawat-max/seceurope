import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { hasSupabaseServerCredentials, supabaseConfig } from "@/lib/config";

let serverClient: SupabaseClient | null = null;

export function getSupabaseServerClient(): SupabaseClient | null {
  if (!hasSupabaseServerCredentials()) {
    return null;
  }

  if (serverClient) {
    return serverClient;
  }

  serverClient = createClient(supabaseConfig.url, supabaseConfig.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return serverClient;
}

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (typeof window === "undefined") {
    return null;
  }
  if (!supabaseConfig.url || !supabaseConfig.anonKey) {
    return null;
  }
  if (browserClient) {
    return browserClient;
  }
  browserClient = createClient(supabaseConfig.url, supabaseConfig.anonKey);
  return browserClient;
}

