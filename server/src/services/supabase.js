import { createClient } from "@supabase/supabase-js";

export function supabaseForToken(accessToken) {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      global: {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}

export function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — required for offline admin operations"
    );
  }
  return createClient(process.env.SUPABASE_URL, key, {
    auth: { persistSession: false },
  });
}
