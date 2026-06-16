"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { apiGet, apiPost } from "@/lib/api";
import { DEV_NO_AUTH } from "@/lib/devauth";
import type { AppConfig, ModelAnswer } from "@/lib/types";

export default function AnswerBankPage() {
  const router = useRouter();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [text, setText] = useState("");
  const [persona, setPersona] = useState("generic");
  const [interviewType, setInterviewType] = useState("Incident response");
  const [results, setResults] = useState<ModelAnswer[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = () => apiGet("/config").then(setConfig).catch(() => {});
    if (DEV_NO_AUTH) { load(); return; }
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.replace("/login"); return; }
      load();
    });
  }, [router]);

  async function generate() {
    const questions = text.split("\n").map((q) => q.trim()).filter(Boolean);
    if (!questions.length) { setError("Paste at least one question (one per line)."); return; }
    setBusy(true); setError(null); setResults([]);
    try {
      const r = await apiPost("/answer-bank", { questions, persona_key: persona, interview_type: interviewType });
      setResults(r.results ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate answers.");
    } finally {
      setBusy(false);
    }
  }

  const typeOptions = config ? [...config.interview_types.technical, ...config.interview_types.behavioral] : [];
  const personaLabel = (k: string) => config?.personas.find((p) => p.key === k)?.company ?? k;

  return (
    <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-8">
      <header className="flex items-center justify-between">
        <div>
          <a href="/dashboard" className="text-sm text-slate-500 hover:text-slate-800">← Dashboard</a>
          <h1 className="text-2xl font-bold text-slate-800 mt-1">📚 Answer Bank</h1>
          <p className="text-sm text-slate-500">Paste interview questions and get strong model answers, graded by what they demonstrate.</p>
        </div>
      </header>

      <section className="mt-6 card p-5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder={"Paste questions, one per line:\nHow would you handle a DSAR backlog?\nTell me about a time you drove change against resistance."}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-sky-500 resize-none"
        />
        <div className="mt-3 flex flex-wrap items-end gap-3">
          {config && (
            <>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Company frame</span>
                <select value={persona} onChange={(e) => setPersona(e.target.value)}
                  className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                  {config.personas.map((p) => <option key={p.key} value={p.key}>{personaLabel(p.key)}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Topic</span>
                <select value={interviewType} onChange={(e) => setInterviewType(e.target.value)}
                  className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                  {typeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
            </>
          )}
          <button onClick={generate} disabled={busy}
            className="ml-auto px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-semibold">
            {busy ? "Generating…" : "Generate answers"}
          </button>
        </div>
        {error && <p className="mt-2 text-rose-500 text-sm">{error}</p>}
      </section>

      <section className="mt-6 space-y-4">
        {results.map((r, i) => (
          <div key={i} className="card p-5">
            <p className="font-semibold text-slate-800">{r.question}</p>
            <p className="mt-2 text-slate-700 whitespace-pre-wrap leading-relaxed">{r.answer}</p>
            {r.key_points.length > 0 && (
              <ul className="mt-3 list-disc list-inside text-sm text-slate-600 space-y-0.5">
                {r.key_points.map((k, j) => <li key={j}>{k}</li>)}
              </ul>
            )}
            {r.principles_demonstrated.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {r.principles_demonstrated.map((p) => (
                  <span key={p} className="rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 text-xs">✓ {p}</span>
                ))}
              </div>
            )}
            {r.coaching_note && <p className="mt-3 text-sm text-amber-700">💡 {r.coaching_note}</p>}
          </div>
        ))}
      </section>
    </main>
  );
}
