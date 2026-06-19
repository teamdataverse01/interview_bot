"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { DEV_NO_AUTH } from "@/lib/devauth";
import { isDemoMode } from "@/lib/gate";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (await isDemoMode()) { router.replace("/demo"); return; }
      if (DEV_NO_AUTH) router.replace("/dashboard");
    })();
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // If email confirmation is off, a session exists immediately.
        const { data } = await supabase.auth.getSession();
        if (data.session) router.replace("/dashboard");
        else setMsg("Account created. Check your email to confirm, then sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace("/dashboard");
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6">
      <div className="w-full max-w-md card p-7">
        <a href="/" className="text-violet-600 font-semibold tracking-wide">DATAVERSE</a>
        <h1 className="mt-2 text-2xl font-bold text-slate-800">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {mode === "signin" ? "Sign in to start a mock interview." : "Start with 3 free interview credits."}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <input
            type="email"
            required
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg bg-white border border-slate-300 px-4 py-3 outline-none focus:border-violet-500"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password (min 6 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg bg-white border border-slate-300 px-4 py-3 outline-none focus:border-violet-500"
          />
          <button
            disabled={busy}
            className="w-full rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 font-semibold text-white py-3 transition"
          >
            {busy ? "..." : mode === "signin" ? "Sign in" : "Sign up"}
          </button>
        </form>

        {msg && <p className="mt-4 text-sm text-amber-600">{msg}</p>}

        <button
          onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMsg(null); }}
          className="mt-6 text-sm text-slate-500 hover:text-slate-800"
        >
          {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </div>
    </main>
  );
}
