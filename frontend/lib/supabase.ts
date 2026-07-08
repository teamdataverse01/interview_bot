import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// In no-auth mode we intentionally allow missing Supabase env vars.
// This prevents build-time crashes during static generation.
const FALLBACK_SUPABASE_URL = "https://placeholder.supabase.co";
const FALLBACK_SUPABASE_KEY = "placeholder-anon-key";

// True only when the real Supabase env vars were baked into the build. When false, auth calls
// would hit a placeholder and fail — the login page uses this to show a clear message.
export const SUPABASE_CONFIGURED = !!supabaseUrl && !!supabaseKey;

// Browser Supabase client (auth only — all data goes through the FastAPI backend).
export const supabase = createClient(
  supabaseUrl || FALLBACK_SUPABASE_URL,
  supabaseKey || FALLBACK_SUPABASE_KEY,
  { auth: { persistSession: true, autoRefreshToken: true } }
);
