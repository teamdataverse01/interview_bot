"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, SUPABASE_CONFIGURED } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/dashboard");
    });
  }, [router]);

  async function google() {
    if (!SUPABASE_CONFIGURED) return;
    setBusy(true);
    setMsg(null);
    const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/dashboard` : undefined;
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (error) { setMsg(error.message); setBusy(false); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!SUPABASE_CONFIGURED) return;
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
      const m = err instanceof Error ? err.message : "Something went wrong.";
      setMsg(/fetch/i.test(m) ? "Can't reach the sign-in server. Please try again in a moment." : m);
    } finally {
      setBusy(false);
    }
  }

  const field =
    "w-full rounded-xl bg-slate-50 text-slate-900 placeholder:text-slate-400 border border-slate-200 " +
    "px-4 py-3 outline-none focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100 transition";

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm rounded-3xl bg-white shadow-[0_20px_70px_-15px_rgba(76,29,149,0.45)] p-8">
        <div className="flex items-center gap-2">
          <span className="grid place-items-center h-9 w-9 rounded-xl bg-linear-to-br from-violet-600 to-fuchsia-500 text-white font-bold">D</span>
          <span className="font-bold tracking-tight text-slate-900">Dataverse</span>
        </div>

        <h1 className="mt-6 text-2xl font-bold text-slate-900">
          {mode === "signin" ? "Sign in" : "Create account"}
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {mode === "signin" ? "Welcome back — let's practice." : "Start with 3 free interview credits."}
        </p>

        {!SUPABASE_CONFIGURED && (
          <p className="mt-5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm p-3">
            Sign-in isn&apos;t configured on this deployment yet (missing Supabase keys at build).
            Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>,
            then redeploy the frontend.
          </p>
        )}

        <button
          onClick={google}
          disabled={busy || !SUPABASE_CONFIGURED}
          className="mt-6 w-full rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold py-3 flex items-center justify-center gap-2 hover:bg-slate-50 disabled:opacity-50 transition"
        >
          <GoogleIcon /> Continue with Google
        </button>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-xs text-slate-400">or</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input type="email" required placeholder="you@email.com"
            value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
          <input type="password" required minLength={6} placeholder="Password"
            value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
          <button disabled={busy || !SUPABASE_CONFIGURED}
            className="w-full rounded-xl bg-linear-to-r from-violet-600 to-fuchsia-600 hover:brightness-110 text-white font-semibold py-3 shadow-md shadow-violet-300/40 disabled:opacity-50 transition">
            {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        {msg && <p className="mt-4 text-sm text-rose-600">{msg}</p>}

        <div className="mt-6 flex items-center justify-between text-sm">
          <button
            onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMsg(null); }}
            className="text-violet-600 hover:text-violet-800 font-medium"
          >
            {mode === "signin" ? "Create an account" : "Have an account? Sign in"}
          </button>
          <a href="/demo" className="text-slate-400 hover:text-slate-600">Have a code?</a>
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
