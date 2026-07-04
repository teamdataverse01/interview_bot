"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { DEV_NO_AUTH } from "@/lib/devauth";
import { isDemoMode } from "@/lib/gate";

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      if (await isDemoMode()) { router.replace("/demo"); return; }
      if (DEV_NO_AUTH) { router.replace("/dashboard"); return; }
      const { data } = await supabase.auth.getSession();
      if (data.session) router.replace("/dashboard");
      else setChecking(false);
    })();
  }, [router]);

  if (checking) return null;

  return (
    <main className="flex-1 flex items-center justify-center px-6">
      <div className="max-w-2xl text-center">
        <p className="text-violet-600 font-bold tracking-[0.2em]">DATAVERSE</p>
        <h1 className="mt-3 text-4xl sm:text-5xl font-extrabold leading-tight text-slate-900">
          AI Interview Coach for <span className="brand-text">privacy careers</span>
        </h1>
        <p className="mt-5 text-slate-600 text-lg">
          Practice realistic mock interviews with an AI trained on real privacy interviews.
          Get scored on the metrics elite hiring managers actually use — and learn exactly what
          gets you to 100.
        </p>
        <div className="mt-8 flex gap-3 justify-center">
          <a
            href="/login"
            className="px-7 py-3 rounded-xl btn-brand font-semibold shadow-lg shadow-violet-300/50"
          >
            Get started →
          </a>
        </div>
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
          {[
            ["Pick your interview", "Industry, role, level, company & difficulty."],
            ["Get probed like the real thing", "One question at a time, follow-ups, rounds."],
            ["Scored on 8 metrics + 6 principles", "Readiness score, stronger answers, gap analysis."],
          ].map(([t, d], i) => (
            <div key={t} className={`card p-4 border-t-4 ${["border-t-violet-500", "border-t-fuchsia-500", "border-t-indigo-500"][i]}`}>
              <p className="font-semibold text-violet-700">{t}</p>
              <p className="text-sm text-slate-500 mt-1">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
