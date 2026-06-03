import { createClient } from "@supabase/supabase-js";
import { DEV_NO_AUTH } from "./devauth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// In no-auth mode we intentionally allow missing Supabase env vars.
// This prevents build-time crashes during static generation.
const FALLBACK_SUPABASE_URL = "https://placeholder.supabase.co";
const FALLBACK_SUPABASE_KEY = "placeholder-anon-key";

if (!DEV_NO_AUTH && (!supabaseUrl || !supabaseKey)) {
  throw new Error(
    "Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
  );
}

// Browser Supabase client (auth only — all data goes through the FastAPI backend).
export const supabase = createClient(
  supabaseUrl || FALLBACK_SUPABASE_URL,
  supabaseKey || FALLBACK_SUPABASE_KEY,
  { auth: { persistSession: true, autoRefreshToken: true } }
);
