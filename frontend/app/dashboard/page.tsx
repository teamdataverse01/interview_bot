"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { apiGet, apiPost } from "@/lib/api";
import { DEV_NO_AUTH, getDemoToken, clearDemoToken } from "@/lib/devauth";
import { isDemoMode } from "@/lib/gate";
import type { AppConfig, SessionListItem, StartResponse } from "@/lib/types";
import { BrandLogo } from "@/components/BrandLogo";

function Select({
  label, value, onChange, options, render,
}: { label: string; value: string; onChange: (v: string) => void; options: string[]; render?: (v: string) => string }) {
  return (
    <label className="block aura-border rounded-2xl p-3.5 impact-outline">
      <span className="text-[10px] font-semibold tracking-[0.16em] uppercase text-violet-100/95">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-xl border border-white/35 bg-white text-violet-950 px-3.5 py-2.5 outline-none font-semibold focus:border-fuchsia-400 focus:ring-4 focus:ring-fuchsia-300/40"
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
      // A real signed-in user (admin/team) always gets in — even in demo mode.
      const { data } = await supabase.auth.getSession();
      if (data.session) { setEmail(data.session.user.email ?? ""); load(); return; }
      // In demo mode, otherwise require a redeemed code token (e.g. the boss master code).
      if (await isDemoMode()) {
        if (getDemoToken()) { load(); return; }
        router.replace("/demo"); return;
      }
      if (DEV_NO_AUTH) { load(); return; }
      router.replace("/login");
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
    <main className="flex-1 max-w-6xl w-full mx-auto px-5 py-7 sm:px-6 sm:py-9">
      <header className="rounded-[1.9rem] p-7 sm:p-9 text-white shadow-xl border border-white/20 rise-in brand-gradient relative overflow-hidden">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-fuchsia-300/25 blur-3xl" />
        <div className="absolute -left-20 -bottom-24 h-64 w-64 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <BrandLogo compact className="mb-5" />
            <span className="hero-chip">Audacious Mode</span>
            <h1 className="mt-4 text-[2.1rem] leading-[0.95] sm:text-[3rem] font-extrabold max-w-3xl">
              Build your interview battlefield.
            </h1>
            <p className="text-violet-100/85 text-base mt-3 max-w-2xl">
              No generic setup. Craft a precision scenario, pressure-test your thinking, and walk out with hire-grade feedback.
            </p>
          </div>

          <div className="text-sm lg:text-right">
            <div className="mb-3 flex flex-wrap gap-2 lg:justify-end">
              {isAdmin && (
                <a href="/admin/metrics" className="rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur px-3.5 py-2 font-semibold transition">
                  Metrics Deck
                </a>
              )}
              <a href="/answer-bank" className="rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur px-3.5 py-2 font-semibold transition">
                Answer Lab
              </a>
            </div>
            <p className="flex flex-wrap gap-2 lg:justify-end items-center">
              <span className="inline-flex items-center rounded-full bg-white/25 px-3.5 py-1.5 font-bold tracking-wide">
                {isAdmin ? "UNLIMITED CREDITS" : `${credits ?? "..."} CREDITS`}
              </span>
              <button onClick={signOut} className="text-violet-100 hover:text-white underline decoration-violet-300/70">Sign out</button>
            </p>
          </div>
        </div>
      </header>

      {error && <p className="mt-4 text-rose-500 text-sm">{error}</p>}

      <section className="mt-7 card p-6 sm:p-7 rise-in">
        <h2 className="font-black text-2xl sm:text-3xl text-white">Start a mock interview</h2>
        <p className="text-sm sm:text-base text-violet-100/90 mt-1.5">
          Compose your interview. Each session uses 1 credit.
        </p>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
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

        <div className="mt-5 rounded-2xl border border-fuchsia-200/45 bg-fuchsia-400/15 px-4 py-3">
          <p className="text-xs font-semibold tracking-[0.12em] uppercase text-violet-100/90">Scenario Brief</p>
          <p className="mt-1.5 text-sm text-violet-50 leading-relaxed">
            <span className="font-semibold">{difficulty}</span>
            {config.difficulty_help?.[difficulty] ? `: ${config.difficulty_help[difficulty]}` : ""}
            {" · "}
            {persona === "generic"
              ? "General interviewer - feedback stays transferable across companies"
              : `Interviewed by ${personaLabel(persona)}`}
            {config.mode_help?.[mode] ? ` · ${config.mode_help[mode]}` : ""}
          </p>
        </div>

        <button onClick={start} disabled={starting || (credits ?? 0) <= 0}
          className="mt-6 w-full sm:w-auto px-8 py-3.5 btn-brand disabled:opacity-50 font-black tracking-wide text-[0.95rem] uppercase">
          {starting ? "Launching..." : (credits ?? 0) <= 0 ? "No credits left" : "Start interview"}
        </button>
      </section>

      {completedAsc.length >= 2 && (
        <section className="mt-8 card p-6 border-t-4 border-t-fuchsia-300/95">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="font-semibold text-lg text-white">Your progress</h2>
              <p className="text-sm text-violet-100/85">Interview readiness across your completed interviews.</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${trend >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
              {trend >= 0 ? `+${trend} since your first` : `${trend} since your first`}
            </span>
          </div>
          <div className="mt-5 flex items-end gap-2 h-40">
            {completedAsc.map((s) => {
              const v = Number(s.overall_confidence) || 0;
              return (
                <div key={s.id} className="flex-1 flex flex-col items-center justify-end h-full"
                  title={`${personaLabel(s.config.persona_key)} · ${s.config.interview_type} — ${v}/100`}>
                  <span className="text-xs font-bold text-violet-700">{v}</span>
                  <div className="w-full max-w-11.5 rounded-t-md brand-gradient" style={{ height: `${Math.max(6, v)}%` }} />
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
        <h2 className="font-semibold text-lg text-white">Your sessions</h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-violet-100/85 mt-2">No interviews yet - launch one above.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {sessions.map((s) => (
              <a key={s.id} href={`/interview/${s.id}`}
                className={`flex items-center justify-between card px-4 py-3 border-l-4 hover:shadow-md transition ${s.status === "completed" ? "border-l-emerald-400" : "border-l-amber-400"}`}>
                <div className="text-sm">
                  <span className="font-semibold text-violet-50">{personaLabel(s.config.persona_key) || s.config.persona_key}</span>
                  <span className="text-violet-100/85"> · {s.config.interview_type} · {s.config.level} · {s.config.difficulty}</span>
                </div>
                <div className="text-sm text-violet-100/85">
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
