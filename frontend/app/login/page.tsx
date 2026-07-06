"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // If already signed in, go straight to the dashboard. (Login stays reachable even in
  // demo mode so admins/team can sign in — demo access codes are unaffected.)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/dashboard");
    });
  }, [router]);

  async function google() {
    setBusy(true);
    setMsg(null);
    const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/dashboard` : undefined;
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (error) { setMsg(error.message); setBusy(false); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
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
      <div className="w-full max-w-md card overflow-hidden">
        <div className="brand-gradient text-white px-7 pt-6 pb-7 text-center">
          <p className="font-bold tracking-[0.2em] text-violet-100">DATAVERSE</p>
          <h1 className="mt-1 text-2xl font-extrabold">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-violet-100/90 text-sm mt-1">
            {mode === "signin" ? "Sign in to practice interviews." : "Start with 3 free interview credits."}
          </p>
        </div>

        <div className="p-7">
          <button
            onClick={google}
            disabled={busy}
            className="w-full rounded-lg bg-white text-slate-800 font-semibold py-3 flex items-center justify-center gap-2 hover:bg-violet-50 disabled:opacity-50"
          >
            <GoogleIcon /> Continue with Google
          </button>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-white/15" />
            <span className="text-xs text-violet-200">or</span>
            <div className="flex-1 h-px bg-white/15" />
          </div>

          <form onSubmit={submit} className="space-y-4">
            <input
              type="email" required placeholder="you@email.com"
              value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-white text-slate-900 placeholder:text-slate-400 border border-white/20 px-4 py-3 outline-none focus:border-violet-500"
            />
            <input
              type="password" required minLength={6} placeholder="Password (min 6 chars)"
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-white text-slate-900 placeholder:text-slate-400 border border-white/20 px-4 py-3 outline-none focus:border-violet-500"
            />
            <button disabled={busy} className="w-full rounded-lg btn-brand disabled:opacity-50 font-semibold py-3">
              {busy ? "…" : mode === "signin" ? "Sign in" : "Sign up"}
            </button>
          </form>

          {msg && <p className="mt-4 text-sm text-amber-300">{msg}</p>}

          <button
            onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMsg(null); }}
            className="mt-6 text-sm text-violet-200 hover:text-white"
          >
            {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}
