"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { apiGet, apiPost } from "@/lib/api";
import type { AppConfig, SessionListItem, StartResponse } from "@/lib/types";

function Select({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="block">
      <span className="text-xs text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 outline-none focus:border-sky-500"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
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
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // interview composition
  const [persona, setPersona] = useState("tiktok");
  const [role, setRole] = useState("Data Privacy Program Manager");
  const [industry, setIndustry] = useState("Social Media");
  const [level, setLevel] = useState("Director");
  const [scale, setScale] = useState("Multi-project");
  const [interviewType, setInterviewType] = useState("Incident response");
  const [difficulty, setDifficulty] = useState("Senior");
  const [mode, setMode] = useState("Coached");

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.replace("/login"); return; }
      setEmail(data.session.user.email ?? "");
      try {
        const [cfg, me, list] = await Promise.all([
          apiGet("/config"),
          apiGet("/me"),
          apiGet("/sessions"),
        ]);
        setConfig(cfg);
        setCredits(me.credits);
        setSessions(list.sessions ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load.");
      }
    });
  }, [router]);

  const typeOptions = useMemo(() => {
    if (!config) return [];
    return [...config.interview_types.technical, ...config.interview_types.behavioral];
  }, [config]);

  async function start() {
    setStarting(true);
    setError(null);
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
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (!config) {
    return <main className="flex-1 grid place-items-center text-slate-400">{error ?? "Loading…"}</main>;
  }

  return (
    <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sky-400 font-semibold tracking-wide">DATAVERSE</p>
          <h1 className="text-2xl font-bold">Interview Coach</h1>
        </div>
        <div className="text-right text-sm">
          <p className="text-slate-300">{email}</p>
          <p className="text-slate-400">
            Credits: <b className="text-sky-300">{credits ?? "…"}</b> ·{" "}
            <button onClick={signOut} className="hover:text-slate-200 underline">Sign out</button>
          </p>
        </div>
      </header>

      {error && <p className="mt-4 text-rose-400 text-sm">{error}</p>}

      {/* Compose interview */}
      <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <h2 className="font-semibold text-lg">Start a mock interview</h2>
        <p className="text-sm text-slate-400">Compose your interview. Each session uses 1 credit.</p>

        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Select label="Company persona" value={persona}
            onChange={setPersona}
            options={config.personas.map((p) => p.key)} />
          <Select label="Industry" value={industry} onChange={setIndustry} options={config.industries} />
          <Select label="Role" value={role} onChange={setRole} options={config.roles} />
          <Select label="Level" value={level} onChange={setLevel} options={config.levels} />
          <Select label="Scale" value={scale} onChange={setScale} options={config.scales} />
          <Select label="Interview type" value={interviewType} onChange={setInterviewType} options={typeOptions} />
          <Select label="Difficulty" value={difficulty} onChange={setDifficulty} options={config.difficulties} />
          <Select label="Mode" value={mode} onChange={setMode} options={config.modes} />
        </div>

        <button
          onClick={start}
          disabled={starting || (credits ?? 0) <= 0}
          className="mt-6 px-6 py-3 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50 font-semibold text-slate-950 transition"
        >
          {starting ? "Starting…" : (credits ?? 0) <= 0 ? "No credits left" : "Start interview"}
        </button>
        <span className="ml-3 text-xs text-slate-500">
          {persona && config.personas.find((p) => p.key === persona)?.values.slice(0, 2).join(" · ")}
        </span>
      </section>

      {/* History */}
      <section className="mt-8">
        <h2 className="font-semibold text-lg">Your sessions</h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-slate-500 mt-2">No interviews yet — start one above.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {sessions.map((s) => (
              <a
                key={s.id}
                href={`/interview/${s.id}`}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3 hover:border-slate-600 transition"
              >
                <div className="text-sm">
                  <span className="font-medium capitalize">{s.config.persona_key}</span>
                  <span className="text-slate-400"> · {s.config.interview_type} · {s.config.level} · {s.config.difficulty}</span>
                </div>
                <div className="text-sm text-slate-400">
                  {s.overall_confidence ? <span className="text-sky-300">{s.overall_confidence}/100</span> : null}
                  <span className={`ml-3 px-2 py-0.5 rounded-full text-xs ${s.status === "completed" ? "bg-emerald-950/50 text-emerald-300" : "bg-amber-950/50 text-amber-300"}`}>
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
