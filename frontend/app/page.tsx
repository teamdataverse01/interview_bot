"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { DEV_NO_AUTH } from "@/lib/devauth";
import { isDemoMode } from "@/lib/gate";
import { BrandLogo } from "@/components/BrandLogo";

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      // A signed-in user always goes to the dashboard, even in demo mode.
      const { data } = await supabase.auth.getSession();
      if (data.session) { router.replace("/dashboard"); return; }
      if (await isDemoMode()) { router.replace("/demo"); return; }
      if (DEV_NO_AUTH) { router.replace("/dashboard"); return; }
      setChecking(false);
    })();
  }, [router]);

  if (checking) return null;

  return (
    <main className="flex-1 px-6 py-10 sm:py-14">
      <div className="max-w-6xl mx-auto">
        <div className="card surface-grid overflow-hidden rise-in">
          <div className="p-7 sm:p-10 md:p-12">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <BrandLogo />
              <a href="/login" className="btn-ghost px-4 py-2 text-sm font-semibold">Team sign in</a>
            </div>

            <div className="mt-10 max-w-3xl">
              <span className="hero-chip">Enterprise Interview Intelligence</span>
              <h1 className="mt-4 text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.05] text-white">
                The <span className="brand-text">premium simulator</span> for privacy leadership interviews
              </h1>
              <p className="mt-5 text-violet-100/88 text-base sm:text-lg leading-relaxed max-w-2xl">
                Rehearse high-stakes interviews with AI trained on real hiring dynamics.
                Get precision scoring on the exact dimensions directors and VPs use to decide who gets the offer.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <a href="/login" className="px-7 py-3.5 btn-brand font-semibold">Start now</a>
              <a href="/demo" className="px-7 py-3.5 btn-ghost font-semibold">Use access code</a>
            </div>
          </div>

          <div className="border-t border-white/10 p-6 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              ["Architected interview loops", "Adaptive rounds, deep follow-ups, and pressure-tested prompts that mirror real panel flow."],
              ["Decision-grade scorecards", "Eight hiring dimensions, six principles, and a confidence model aligned to executive hiring bars."],
              ["Actionable growth path", "Debriefs, model answers, and retries that convert weak responses into offer-level narratives."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-2xl border border-white/10 bg-white/4 p-4">
                <p className="font-semibold text-violet-100">{t}</p>
                <p className="text-sm text-violet-200/90 mt-2 leading-relaxed">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
