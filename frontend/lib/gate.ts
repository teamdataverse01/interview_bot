import { apiGet } from "./api";
import { DEMO_MODE } from "./devauth";

// Whether the app should run in demo mode. Prefers the build-time flag, but falls back to the
// BACKEND's runtime /config.demo_mode so the gate works even if NEXT_PUBLIC_DEMO_MODE wasn't
// baked into the build. /config is unauthenticated, so this never 401s.
let cached: boolean | null = null;

export async function isDemoMode(): Promise<boolean> {
  if (DEMO_MODE) return true;
  if (cached !== null) return cached;
  try {
    const cfg = await apiGet("/config");
    cached = !!cfg?.demo_mode;
  } catch {
    cached = false;
  }
  return cached;
}
