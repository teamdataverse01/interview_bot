"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";
import { setDemoToken } from "@/lib/devauth";

export default function DemoPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function redeem(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await apiPost("/demo/redeem", { code: trimmed });
      setDemoToken(r.token);
      // Master (boss) code unlocks the full dashboard; student codes go straight to their session.
      router.replace(r.master ? "/dashboard" : `/interview/${r.session_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start. Check your code.");
      setBusy(false);
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6">
      <div className="w-full max-w-md card overflow-hidden text-center">
        <div className="brand-gradient text-white px-8 pt-7 pb-8">
          <p className="font-bold tracking-[0.2em] text-violet-100">DATAVERSE</p>
          <h1 className="mt-1 text-2xl font-extrabold">Welcome 👋</h1>
          <p className="text-violet-100/90 mt-2 text-sm">
            Enter your access code to start your AI mock interview. Each code is good for one session.
          </p>
        </div>
        <div className="p-8 pt-6">

        <form onSubmit={redeem} className="mt-6 space-y-4">
          <input
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="DV-XXXXXX"
            className="w-full text-center tracking-widest uppercase rounded-lg bg-white border border-slate-300 px-4 py-3 text-lg outline-none focus:border-violet-500"
          />
          <button
            disabled={busy || !code.trim()}
            className="w-full rounded-lg btn-brand disabled:opacity-50 font-semibold py-3"
          >
            {busy ? "Starting your interview…" : "Start interview"}
          </button>
        </form>

        {error && <p className="mt-4 text-sm text-rose-500">{error}</p>}

        <p className="mt-6 text-xs text-slate-400">
          Don&apos;t have a code? Ask your facilitator.
        </p>
        </div>
      </div>
    </main>
  );
}
