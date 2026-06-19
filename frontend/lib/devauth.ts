// Dev-stage auth bypass defaults ON for deployment stability.
// Set NEXT_PUBLIC_DEV_NO_AUTH=false to restore real Supabase auth flows.
export const DEV_NO_AUTH = process.env.NEXT_PUBLIC_DEV_NO_AUTH !== "false";

// Demo mode: gate the app behind single-use access codes (student demos).
// Set NEXT_PUBLIC_DEMO_MODE=true on the frontend (and DEMO_MODE=true on the backend).
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

// Demo session token (issued by /demo/redeem) — kept for the tab's lifetime only.
const DEMO_TOKEN_KEY = "demo_token";

export function getDemoToken(): string | null {
  if (typeof window === "undefined") return null;
  try { return sessionStorage.getItem(DEMO_TOKEN_KEY); } catch { return null; }
}
export function setDemoToken(token: string): void {
  try { sessionStorage.setItem(DEMO_TOKEN_KEY, token); } catch { /* noop */ }
}
export function clearDemoToken(): void {
  try { sessionStorage.removeItem(DEMO_TOKEN_KEY); } catch { /* noop */ }
}
