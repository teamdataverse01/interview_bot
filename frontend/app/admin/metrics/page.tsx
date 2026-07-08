"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "@/lib/api";
import { DIMENSION_LABELS } from "@/lib/types";
import { BrandLogo } from "@/components/BrandLogo";

type Row = { label: string; n: number };
type Metrics = {
  total_users: number; signups_today: number; signups_week: number;
  active_today: number; active_week: number;
  total_interviews: number; interviews_completed: number; interviews_active: number;
  answers_evaluated: number; avg_questions_per_interview: number | null;
  avg_readiness: number | null; kb_chunks: number | null;
  dimension_averages: Record<string, number | null>;
  recommendations: Row[]; by_type: Row[]; by_interviewer: Row[]; by_difficulty: Row[];
  activity: { status: string; started_at: string; type: string; persona: string; email: string }[];
  planned: string[];
};

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-violet-200">{label}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
      {sub && <p className="text-xs text-violet-300 mt-0.5">{sub}</p>}
    </div>
  );
}

function BarList({ rows, color = "bg-fuchsia-500" }: { rows: Row[]; color?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="space-y-1.5">
      {rows.filter((r) => r.label).map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          <span className="w-40 shrink-0 text-xs text-violet-100 truncate">{r.label}</span>
          <div className="flex-1 h-3 rounded bg-white/10 overflow-hidden">
            <div className={`h-full ${color}`} style={{ width: `${(r.n / max) * 100}%` }} />
          </div>
          <span className="w-8 text-right text-xs text-violet-200 tabular-nums">{r.n}</span>
        </div>
      ))}
    </div>
  );
}

export default function MetricsPage() {
  const router = useRouter();
  const [m, setM] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const me = await apiGet("/me");
        if (!me.is_admin) { router.replace("/dashboard"); return; }
        setM(await apiGet("/admin/metrics"));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load metrics.");
      }
    })();
  }, [router]);

  if (error) return <main className="flex-1 grid place-items-center text-rose-300">{error}</main>;
  if (!m) return <main className="flex-1 grid place-items-center text-violet-200">Loading metrics…</main>;

  return (
    <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
      <header className="rounded-2xl p-6 text-white shadow-lg flex items-center justify-between brand-gradient rise-in">
        <div>
          <BrandLogo compact className="mb-2" />
          <p className="text-violet-100/90 font-semibold tracking-widest text-xs">ADMIN</p>
          <h1 className="text-2xl font-bold">Metrics Dashboard</h1>
        </div>
        <a href="/dashboard" className="rounded-lg bg-white/15 hover:bg-white/25 px-3 py-1.5 text-sm font-medium">← Dashboard</a>
      </header>

      {/* Platform overview */}
      <h2 className="mt-8 mb-3 font-semibold text-lg text-white">Platform overview</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Total users" value={m.total_users} sub={`+${m.signups_week} this week`} />
        <Stat label="Active today" value={m.active_today} sub={`${m.active_week} this week`} />
        <Stat label="Interviews" value={m.total_interviews} sub={`${m.interviews_completed} completed · ${m.interviews_active} active`} />
        <Stat label="New signups today" value={m.signups_today} />
        <Stat label="Avg readiness" value={m.avg_readiness ?? "—"} sub="out of 100" />
        <Stat label="Answers evaluated" value={m.answers_evaluated} />
        <Stat label="Avg questions / interview" value={m.avg_questions_per_interview ?? "—"} />
        <Stat label="Knowledge chunks" value={m.kb_chunks ?? "—"} sub="RAG index" />
      </div>

      {/* Performance */}
      <h2 className="mt-8 mb-3 font-semibold text-lg text-white">Interview performance</h2>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5">
          <p className="font-medium text-violet-100 mb-3">Average scores by dimension</p>
          <div className="space-y-1.5">
            {Object.entries(m.dimension_averages).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2">
                <span className="w-32 shrink-0 text-xs text-violet-200">{DIMENSION_LABELS[k] ?? k}</span>
                <div className="flex-1 h-3 rounded bg-white/10 overflow-hidden">
                  <div className="h-full bg-violet-400" style={{ width: `${((v ?? 0) / 10) * 100}%` }} />
                </div>
                <span className="w-8 text-right text-xs text-violet-100 tabular-nums">{v ?? "—"}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <p className="font-medium text-violet-100 mb-3">Hiring recommendations</p>
          <BarList rows={m.recommendations} color="bg-emerald-400" />
        </div>
      </div>

      {/* Content analytics */}
      <h2 className="mt-8 mb-3 font-semibold text-lg text-white">Content analytics</h2>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="card p-5"><p className="font-medium text-violet-100 mb-3">By interview type</p><BarList rows={m.by_type} /></div>
        <div className="card p-5"><p className="font-medium text-violet-100 mb-3">By interviewer</p><BarList rows={m.by_interviewer} color="bg-indigo-400" /></div>
        <div className="card p-5"><p className="font-medium text-violet-100 mb-3">By difficulty</p><BarList rows={m.by_difficulty} color="bg-pink-400" /></div>
      </div>

      {/* Activity feed */}
      <h2 className="mt-8 mb-3 font-semibold text-lg text-white">Activity feed</h2>
      <div className="card p-5">
        <ul className="space-y-2">
          {m.activity.map((a, i) => (
            <li key={i} className="text-sm text-violet-100 flex items-center gap-2">
              <span className="text-violet-300 tabular-nums text-xs w-28 shrink-0">
                {new Date(a.started_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className={`w-2 h-2 rounded-full ${a.status === "completed" ? "bg-emerald-400" : "bg-amber-400"}`} />
              <span className="truncate">
                <b>{a.email}</b> · {a.type} · {a.persona} · {a.status}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Planned */}
      <h2 className="mt-8 mb-3 font-semibold text-lg text-white">Coming at launch</h2>
      <div className="card p-5">
        <div className="flex flex-wrap gap-2">
          {m.planned.map((p) => (
            <span key={p} className="rounded-full border border-white/15 bg-white/5 text-violet-200 px-3 py-1 text-xs">{p}</span>
          ))}
        </div>
        <p className="text-xs text-violet-300 mt-3">These need billing + usage telemetry, wired in when payments go live.</p>
      </div>
    </main>
  );
}
