import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./config";

export const isSupabaseAdminConfigured = Boolean(
  supabaseUrl && process.env.SUPABASE_SECRET_KEY?.trim(),
);

export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!supabaseUrl || !secretKey) throw new Error("Supabase server key is not configured");
  return createSupabaseClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
