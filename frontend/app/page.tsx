"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { DEV_NO_AUTH } from "@/lib/devauth";

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (DEV_NO_AUTH) { router.replace("/dashboard"); return; }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/dashboard");
      else setChecking(false);
    });
  }, [router]);

  if (checking) return null;

  return (
    <main className="flex-1 flex items-center justify-center px-6">
      <div className="max-w-2xl text-center">
        <p className="text-sky-400 font-semibold tracking-wide">DATAVERSE</p>
        <h1 className="mt-3 text-4xl sm:text-5xl font-bold leading-tight">
          AI Interview Coach for <span className="text-sky-400">privacy careers</span>
        </h1>
        <p className="mt-5 text-slate-300 text-lg">
          Practice realistic mock interviews with an AI trained on real Netflix, TikTok, and Strava
          privacy interviews. Get scored on the metrics elite hiring managers actually use.
        </p>
        <div className="mt-8 flex gap-3 justify-center">
          <a
            href="/login"
            className="px-6 py-3 rounded-lg bg-sky-500 hover:bg-sky-400 font-semibold text-slate-950 transition"
          >
            Get started
          </a>
        </div>
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
          {[
            ["Pick your interview", "Industry, role, level, company persona & difficulty."],
            ["Get probed like the real thing", "One question at a time, follow-ups, lens switching."],
            ["Scored on 8 metrics + 6 principles", "Confidence score, stronger answers, missed concepts."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <p className="font-semibold text-sky-300">{t}</p>
              <p className="text-sm text-slate-400 mt-1">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
