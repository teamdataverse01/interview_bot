"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { apiGet, apiPost } from "@/lib/api";
import { DEV_NO_AUTH, getDemoToken, clearDemoToken } from "@/lib/devauth";
import { isDemoMode } from "@/lib/gate";
import type { AppConfig, SessionListItem, StartResponse } from "@/lib/types";

function Select({
  label, value, onChange, options, render,
}: { label: string; value: string; onChange: (v: string) => void; options: string[]; render?: (v: string) => string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-violet-200">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-white/20 bg-white text-slate-900 px-3 py-2 outline-none focus:border-violet-500"
      >
        {options.map((o) => (
          <option key={o} value={o} className="text-slate-900">{render ? render(o) : o}</option>
        ))}
      </select>
    </label>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [persona, setPersona] = useState("generic");
  const [role, setRole] = useState("Data Privacy Program Manager");
  const [industry, setIndustry] = useState("Social Media");
  const [level, setLevel] = useState("Director");
  const [scale, setScale] = useState("Multi-project");
  const [interviewType, setInterviewType] = useState("Incident response");
  const [difficulty, setDifficulty] = useState("Senior");
  const [mode, setMode] = useState("Practice");

  useEffect(() => {
    async function load() {
      try {
        const [cfg, me, list] = await Promise.all([apiGet("/config"), apiGet("/me"), apiGet("/sessions")]);
        setConfig(cfg); setCredits(me.credits); setEmail(me.email ?? ""); setIsAdmin(!!me.is_admin); setSessions(list.sessions ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load.");
      }
    }
    (async () => {
      // In demo mode, only a redeemed token (e.g. the boss master code) can reach the dashboard.
      if (await isDemoMode()) {
        if (getDemoToken()) { load(); return; }
        router.replace("/demo"); return;
      }
      if (DEV_NO_AUTH) { load(); return; }
      const { data } = await supabase.auth.getSession();
      if (!data.session) { router.replace("/login"); return; }
      setEmail(data.session.user.email ?? "");
      load();
    })();
  }, [router]);

  const typeOptions = useMemo(() => {
    if (!config) return [];
    return [...config.interview_types.technical, ...config.interview_types.behavioral];
  }, [config]);

  const personaLabel = (key: string) =>
    config?.personas.find((p) => p.key === key)?.company ?? key;

  async function start() {
    setStarting(true); setError(null);
    try {
      const res: StartResponse = await apiPost("/sessions", {
        persona_key: persona, role, industry, level, scale,
        interview_type: interviewType, difficulty, mode,
      });
      router.push(`/interview/${res.session_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start.");
      setStarting(false);
    }
  }

  async function signOut() {
    clearDemoToken();
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
    router.replace("/login");
  }

  if (!config) {
    return <main className="flex-1 grid place-items-center text-violet-200">{error ?? "Loading…"}</main>;
  }

  // Completed interviews with a readiness score, oldest -> newest (for the progress chart).
  const completedAsc = sessions
    .filter((s) => s.status === "completed" && s.overall_confidence != null)
    .slice()
    .reverse();
  const first = completedAsc.length ? Number(completedAsc[0].overall_confidence) : 0;
  const last = completedAsc.length ? Number(completedAsc[completedAsc.length - 1].overall_confidence) : 0;
  const trend = last - first;

  return (
    <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8">
      <header className="rounded-2xl p-6 text-white shadow-lg flex items-center justify-between bg-linear-to-r from-violet-600 via-purple-600 to-fuchsia-600">
        <div>
          <p className="text-violet-100/90 font-semibold tracking-widest text-xs">DATAVERSE</p>
          <h1 className="text-2xl font-bold">AI Interview Coach</h1>
          <p className="text-violet-100/90 text-sm mt-1">Practice. Get scored. Level up. 🚀</p>
        </div>
        <div className="text-right text-sm">
          <div className="mb-2 flex justify-end gap-2">
            {isAdmin && (
              <a href="/admin/metrics" className="rounded-lg bg-white/15 hover:bg-white/25 backdrop-blur px-3 py-1.5 font-medium transition">
                📊 Metrics
              </a>
            )}
            <a href="/answer-bank" className="rounded-lg bg-white/15 hover:bg-white/25 backdrop-blur px-3 py-1.5 font-medium transition">
              📚 Answer Bank
            </a>
          </div>
          <p>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 font-semibold">
              💎 {isAdmin ? "Unlimited" : `${credits ?? "…"} credits`}
            </span>
            <button onClick={signOut} className="ml-2 text-violet-100 hover:text-white underline">Sign out</button>
          </p>
        </div>
      </header>

      {error && <p className="mt-4 text-rose-500 text-sm">{error}</p>}

      <section className="mt-8 card p-6 border-t-4 border-t-violet-500">
        <h2 className="font-semibold text-lg text-white">🎯 Start a mock interview</h2>
        <p className="text-sm text-violet-200">Compose your interview. Each session uses 1 credit.</p>

        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Select label="Interviewer" value={persona} onChange={setPersona}
            options={config.personas.map((p) => p.key)} render={personaLabel} />
          <Select label="Industry" value={industry} onChange={setIndustry} options={config.industries} />
          <Select label="Role" value={role} onChange={setRole} options={config.roles} />
          <Select label="Level" value={level} onChange={setLevel} options={config.levels} />
          <Select label="Scale" value={scale} onChange={setScale} options={config.scales} />
          <Select label="Interview type" value={interviewType} onChange={setInterviewType} options={typeOptions} />
          <Select label="Difficulty" value={difficulty} onChange={setDifficulty} options={config.difficulties} />
          <Select label="Mode" value={mode} onChange={setMode} options={config.modes} />
        </div>

        <p className="mt-2 text-xs text-violet-200">
          {config.difficulty_help?.[difficulty] ? `${difficulty}: ${config.difficulty_help[difficulty]} · ` : ""}
          {persona === "generic"
            ? "General interviewer — feedback stays transferable across companies."
            : `Interviewed by a ${personaLabel(persona)}.`}
          {config.mode_help?.[mode] ? ` · ${config.mode_help[mode]}` : ""}
        </p>

        <button onClick={start} disabled={starting || (credits ?? 0) <= 0}
          className="mt-5 px-6 py-3 rounded-lg bg-linear-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 disabled:opacity-50 text-white font-semibold transition shadow-md">
          {starting ? "Starting…" : (credits ?? 0) <= 0 ? "No credits left" : "Start interview →"}
        </button>
      </section>

      {completedAsc.length >= 2 && (
        <section className="mt-8 card p-6 border-t-4 border-t-fuchsia-500">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="font-semibold text-lg text-white">📈 Your progress</h2>
              <p className="text-sm text-violet-200">Interview readiness across your completed interviews.</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${trend >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
              {trend >= 0 ? `▲ +${trend} since your first` : `▼ ${trend} since your first`}
            </span>
          </div>
          <div className="mt-5 flex items-end gap-2 h-40">
            {completedAsc.map((s) => {
              const v = Number(s.overall_confidence) || 0;
              return (
                <div key={s.id} className="flex-1 flex flex-col items-center justify-end h-full"
                  title={`${personaLabel(s.config.persona_key)} · ${s.config.interview_type} — ${v}/100`}>
                  <span className="text-xs font-bold text-violet-700">{v}</span>
                  <div className="w-full max-w-[46px] rounded-t-md brand-gradient" style={{ height: `${Math.max(6, v)}%` }} />
                  <span className="text-[10px] text-violet-300 mt-1">
                    {new Date(s.started_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-semibold text-lg text-white">📊 Your sessions</h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-violet-200 mt-2">No interviews yet — start one above.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {sessions.map((s) => (
              <a key={s.id} href={`/interview/${s.id}`}
                className={`flex items-center justify-between card px-4 py-3 border-l-4 hover:shadow-md transition ${s.status === "completed" ? "border-l-emerald-400" : "border-l-amber-400"}`}>
                <div className="text-sm">
                  <span className="font-medium text-violet-700">{personaLabel(s.config.persona_key) || s.config.persona_key}</span>
                  <span className="text-violet-200"> · {s.config.interview_type} · {s.config.level} · {s.config.difficulty}</span>
                </div>
                <div className="text-sm text-violet-200">
                  {s.overall_confidence ? <span className="rounded-full bg-violet-100 text-violet-700 px-2.5 py-0.5 font-bold">{s.overall_confidence}/100</span> : null}
                  <span className={`ml-3 px-2 py-0.5 rounded-full text-xs ${s.status === "completed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {s.status}
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
