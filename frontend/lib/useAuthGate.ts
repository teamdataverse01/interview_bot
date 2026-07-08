"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "./supabase";
import { DEMO_MODE, DEV_NO_AUTH, getDemoToken } from "./devauth";
import { isDemoMode } from "./gate";

/**
 * Single source of truth for protecting a page. Resolves access in this order:
 *   1. A redeemed demo code token  -> allowed (demo interview session).
 *   2. Demo mode without a token   -> send to /demo (need a code).
 *   3. Dev bypass (team only)      -> allowed.
 *   4. Real auth                   -> require a live Supabase session, else /login.
 *
 * Also subscribes to auth changes so a sign-out or expired session immediately
 * bounces the user to /login (no stale/porous access).
 */
export function useAuthGate(): { ready: boolean } {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function check() {
      if (getDemoToken()) { if (active) setReady(true); return; }
      if (DEMO_MODE || (await isDemoMode())) { router.replace("/demo"); return; }
      if (DEV_NO_AUTH) { if (active) setReady(true); return; }
      const { data } = await supabase.auth.getSession();
      if (!data.session) { router.replace("/login"); return; }
      if (active) setReady(true);
    }
    check();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Only enforce for real-auth mode (not dev/demo).
      if (DEV_NO_AUTH || getDemoToken()) return;
      if (event === "SIGNED_OUT" || !session) router.replace("/login");
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  return { ready };
}
