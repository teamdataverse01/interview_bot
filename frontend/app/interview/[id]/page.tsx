"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { apiGet, apiPost } from "@/lib/api";
import type { AnswerResponse, Evaluation, Message, Report, SessionDetail } from "@/lib/types";
import { Scorecard } from "@/components/Scorecard";

export default function InterviewPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [messages, setMessages] = useState<Message[]>([]);
  const [evals, setEvals] = useState<Evaluation[]>([]);
  const [status, setStatus] = useState("active");
  const [mode, setMode] = useState("Coached");
  const [stageLabel, setStageLabel] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [persona, setPersona] = useState("");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.replace("/login"); return; }
      try {
        const d: SessionDetail = await apiGet(`/sessions/${id}`);
        setMessages(d.messages);
        setEvals(
          d.evaluations.map((e) => ({
            scores: e.scores, principles: e.principles, confidence_score: e.confidence,
            stronger_answer: e.stronger_answer, missed_concepts: e.missed_concepts,
            star_notes: e.star_notes,
          }))
        );
        setStatus(d.session.status);
        setMode(d.session.config.mode ?? "Coached");
        setPersona(d.session.config.persona_key ?? "");
        setReport(d.session.report);
        const lastInt = [...d.messages].reverse().find((m) => m.sender === "interviewer");
        setStageLabel(lastInt ? `Stage ${lastInt.stage}` : "");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load session.");
      }
    });
  }, [id, router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, report]);

  async function send() {
    const answer = input.trim();
    if (!answer || sending || status !== "active") return;
    setSending(true);
    setError(null);
    setMessages((m) => [...m, { sender: "candidate", stage: 0, lens: null, content: answer }]);
    setInput("");
    try {
      const r: AnswerResponse = await apiPost(`/sessions/${id}/answer`, { answer });
      if (r.evaluation) setEvals((e) => [...e, r.evaluation!]);
      setMessages((m) => [...m, { sender: "interviewer", stage: r.stage, lens: r.lens, content: r.question }]);
      setStageLabel(r.stage_label);
      if (r.finished) {
        setStatus("completed");
        if (r.report) setReport(r.report);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send.");
    } finally {
      setSending(false);
    }
  }

  // zip candidate messages with evaluations in order
  let candIdx = -1;

  return (
    <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 flex flex-col">
      <header className="flex items-center justify-between">
        <a href="/dashboard" className="text-sm text-slate-400 hover:text-slate-200">← Dashboard</a>
        <span className="text-sm text-slate-400 capitalize">
          {persona} · {stageLabel} · <span className="text-slate-500">{mode}</span>
        </span>
      </header>

      <div className="mt-4 flex-1 overflow-y-auto scroll-thin space-y-4 pr-1">
        {report && <ReportBanner report={report} />}

        {messages.map((m, i) => {
          if (m.sender === "candidate") candIdx++;
          const ev = m.sender === "candidate" ? evals[candIdx] : undefined;
          return (
            <div key={i}>
              <div className={m.sender === "interviewer" ? "flex" : "flex justify-end"}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    m.sender === "interviewer"
                      ? "bg-slate-800 text-slate-100 rounded-tl-sm"
                      : "bg-sky-600 text-white rounded-tr-sm"
                  }`}
                >
                  {m.sender === "interviewer" && (
                    <p className="text-[11px] uppercase tracking-wide text-sky-300/80 mb-1">
                      Interviewer {m.lens ? `· ${m.lens}` : ""}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                </div>
              </div>
              {ev && <div className="mt-2">{<Scorecard ev={ev} />}</div>}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error && <p className="text-rose-400 text-sm mt-2">{error}</p>}

      {status === "active" ? (
        <div className="mt-3 border-t border-slate-800 pt-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); }}
            placeholder="Type your answer…  (Ctrl/⌘+Enter to send)"
            rows={3}
            disabled={sending}
            className="w-full rounded-xl bg-slate-900 border border-slate-700 px-4 py-3 outline-none focus:border-sky-500 resize-none"
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-slate-500">{sending ? "Interviewer is thinking…" : ""}</span>
            <button
              onClick={send}
              disabled={sending || !input.trim()}
              className="px-5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50 font-semibold text-slate-950 transition"
            >
              Send
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 border-t border-slate-800 pt-3 text-center">
          <p className="text-slate-400 text-sm">Interview complete.</p>
          <a href="/dashboard" className="inline-block mt-2 text-sky-300 hover:text-sky-200">Back to dashboard →</a>
        </div>
      )}
    </main>
  );
}

function ReportBanner({ report }: { report: Report }) {
  return (
    <div className="rounded-2xl border border-sky-800 bg-sky-950/30 p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold text-lg">Session report</h2>
        <span className="text-2xl font-bold text-sky-300">{report.overall_confidence}<span className="text-base text-slate-400">/100</span></span>
      </div>
      <p className="mt-2 text-sm text-slate-300">{report.summary}</p>
      {report.strengths.length > 0 && (
        <p className="mt-2 text-sm"><span className="text-slate-500">Strengths: </span>{report.strengths.join(", ")}</p>
      )}
      {report.weaknesses.length > 0 && (
        <p className="text-sm"><span className="text-slate-500">Focus areas: </span>{report.weaknesses.join(", ")}</p>
      )}
    </div>
  );
}
