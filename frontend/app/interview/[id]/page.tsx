"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { apiGet, apiPost, apiUpload } from "@/lib/api";
import { DEMO_MODE, DEV_NO_AUTH, getDemoToken } from "@/lib/devauth";
import type {
  AnswerResponse, AppConfig, Evaluation, Message, Report, SessionDetail,
} from "@/lib/types";
import { Scorecard } from "@/components/Scorecard";
import { ScoreRing } from "@/components/ScoreRing";
import { TermDefs } from "@/components/TermDefs";
import { findTerms } from "@/lib/glossary";
import { useAudioRecorder, useTextToSpeech } from "@/lib/useSpeech";

export default function InterviewPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [messages, setMessages] = useState<Message[]>([]);
  const [evals, setEvals] = useState<Evaluation[]>([]);
  const [status, setStatus] = useState("active");
  const [mode, setMode] = useState("Practice");
  const [persona, setPersona] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [round, setRound] = useState(1);
  const [qInRound, setQInRound] = useState(1);
  const [roundSize, setRoundSize] = useState(4);
  const [roundComplete, setRoundComplete] = useState(false);
  const [roundSummary, setRoundSummary] = useState<Report | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [switchTopic, setSwitchTopic] = useState("");

  const [input, setInput] = useState("");
  const [clarifyInput, setClarifyInput] = useState("");
  const [showClarify, setShowClarify] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // --- speech (Web Speech API) ---
  const tts = useTextToSpeech();
  const recorder = useAudioRecorder();
  const [voiceOn, setVoiceOn] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const lastSpokenRef = useRef("");

  useEffect(() => {
    async function load() {
      try {
        const [d, cfg] = await Promise.all([
          apiGet(`/sessions/${id}`) as Promise<SessionDetail>,
          apiGet(`/config`) as Promise<AppConfig>,
        ]);
        setMessages(d.messages);
        setEvals(
          d.evaluations.map((e) => ({
            scores: e.scores, principles: e.principles, confidence_score: e.confidence,
            stronger_answer: e.stronger_answer, missed_concepts: e.missed_concepts,
            star_notes: e.star_notes, to_improve: (e as { to_improve?: string }).to_improve,
          }))
        );
        setStatus(d.session.status);
        setMode(d.session.config.mode ?? "Practice");
        setPersona(d.session.config.persona_key ?? "");
        setSwitchTopic(d.session.config.interview_type ?? "");
        setReport(d.session.report);
        setRoundSize(cfg.round_size ?? 4);
        setTopics([...cfg.interview_types.technical, ...cfg.interview_types.behavioral]);
        const answered = d.messages.filter((m) => m.sender === "candidate" && m.kind !== "ask").length;
        const askedQ = d.messages.filter((m) => m.sender === "interviewer" && m.kind !== "clarify").length;
        setRound(Math.max(1, Math.floor((askedQ - 1) / (cfg.round_size ?? 4)) + 1));
        setQInRound(askedQ ? ((askedQ - 1) % (cfg.round_size ?? 4)) + 1 : 0);
        // If the last answered question completed a round and no new question followed, pause.
        if (answered > 0 && answered % (cfg.round_size ?? 4) === 0 && d.session.status === "active" && askedQ === answered) {
          setRoundComplete(true);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load session.");
      }
    }
    if (DEV_NO_AUTH || DEMO_MODE || getDemoToken()) { load(); return; }
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.replace("/login"); return; }
      load();
    });
  }, [id, router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, report, roundComplete]);

  // Read the latest interviewer message aloud when voice is on.
  useEffect(() => {
    if (!voiceOn) return;
    const lastInt = [...messages].reverse().find((m) => m.sender === "interviewer");
    if (lastInt && lastInt.content !== lastSpokenRef.current) {
      lastSpokenRef.current = lastInt.content;
      tts.speak(lastInt.content);
    }
  }, [messages, voiceOn, tts]);

  function toggleVoice() {
    if (voiceOn) { tts.stop(); setVoiceOn(false); }
    else {
      setVoiceOn(true);
      const lastInt = [...messages].reverse().find((m) => m.sender === "interviewer");
      if (lastInt) { lastSpokenRef.current = lastInt.content; tts.speak(lastInt.content); }
    }
  }

  async function toggleMic() {
    if (transcribing) return;
    if (recorder.recording) {
      let blob: Blob;
      try { blob = await recorder.stop(); } catch { return; }
      setTranscribing(true);
      setError(null);
      try {
        const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm";
        const form = new FormData();
        form.append("file", blob, `answer.${ext}`);
        const r = await apiUpload("/transcribe", form);
        const text: string = (r.text || "").trim();
        if (text) setInput((prev) => (prev.trim() ? prev.trim() + " " : "") + text);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Transcription failed.");
      } finally {
        setTranscribing(false);
      }
    } else {
      setError(null);
      try { await recorder.start(); } catch { setError("Microphone access denied or unavailable."); }
    }
  }

  function applyRoundInfo(r: AnswerResponse) {
    if (r.round) setRound(r.round);
    if (typeof r.question_in_round === "number") setQInRound(r.question_in_round);
  }

  async function send() {
    const answer = input.trim();
    if (!answer || sending || status !== "active" || roundComplete || recorder.recording || transcribing) return;
    setSending(true);
    setError(null);
    setMessages((m) => [...m, { sender: "candidate", stage: 0, lens: null, content: answer, kind: "answer" }]);
    setInput("");
    try {
      const r: AnswerResponse = await apiPost(`/sessions/${id}/answer`, { answer });
      if (r.evaluation) setEvals((e) => [...e, r.evaluation!]);
      applyRoundInfo(r);
      if (r.round_complete) {
        setRoundComplete(true);
        setRoundSummary(r.round_summary ?? null);
      } else if (r.question) {
        setMessages((m) => [...m, { sender: "interviewer", stage: r.stage, lens: r.lens, content: r.question!, kind: "question" }]);
      }
      if (r.finished) { setStatus("completed"); if (r.report) setReport(r.report); }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send.");
    } finally {
      setSending(false);
    }
  }

  async function doContinue(withSwitch: boolean) {
    setSending(true);
    setError(null);
    try {
      const body = withSwitch && switchTopic ? { switch_topic: switchTopic } : {};
      const r: AnswerResponse = await apiPost(`/sessions/${id}/continue`, body);
      setRoundComplete(false);
      setRoundSummary(null);
      applyRoundInfo(r);
      if (r.question) {
        setMessages((m) => [...m, { sender: "interviewer", stage: r.stage, lens: r.lens, content: r.question!, kind: "question" }]);
      }
      if (r.finished) { setStatus("completed"); if (r.report) setReport(r.report); }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to continue.");
    } finally {
      setSending(false);
    }
  }

  async function finishNow() {
    setSending(true);
    try {
      const r = await apiPost(`/sessions/${id}/end`);
      setReport(r.report);
      setStatus("completed");
      setRoundComplete(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to finish.");
    } finally {
      setSending(false);
    }
  }

  async function askClarify() {
    const request = clarifyInput.trim();
    if (!request || sending) return;
    setSending(true);
    setError(null);
    setClarifyInput("");
    setShowClarify(false);
    setMessages((m) => [...m, { sender: "candidate", stage: 0, lens: null, content: request, kind: "ask" }]);
    try {
      const r = await apiPost(`/sessions/${id}/clarify`, { request });
      setMessages((m) => [...m, { sender: "interviewer", stage: 0, lens: null, content: r.clarification, kind: "clarify" }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to get clarification.");
    } finally {
      setSending(false);
    }
  }

  // Track glossary terms already shown, and align evals to answered candidate messages.
  const seen = useMemo(() => new Set<string>(), [messages.length]);
  let answerIdx = -1;

  return (
    <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 flex flex-col">
      <header className="flex items-center justify-between">
        <a href="/dashboard" className="text-sm text-slate-500 hover:text-slate-800">← Dashboard</a>
        <div className="flex items-center gap-3 text-sm">
          {tts.supported && (
            <button
              onClick={toggleVoice}
              title={voiceOn ? "Turn off the interviewer's voice" : "Have the interviewer read questions aloud"}
              className={`rounded-full px-3 py-1 font-medium border ${
                voiceOn ? "bg-violet-600 text-white border-violet-600" : "border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {voiceOn ? "🔊 Voice on" : "🔈 Voice"}
            </button>
          )}
          <span className="rounded-full bg-violet-100 text-violet-700 px-3 py-1 font-medium">
            Round {round} · Q{qInRound || 1}/{roundSize}
          </span>
          <span className="text-slate-500 capitalize">{persona === "generic" ? "General" : persona} · {mode}</span>
        </div>
      </header>

      <div className="mt-4 flex-1 overflow-y-auto scroll-thin space-y-4 pr-1">
        {report && <ReportBanner report={report} />}

        {messages.map((m, i) => {
          if (m.kind === "ask") {
            return (
              <div key={i} className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-slate-100 text-slate-600 px-4 py-2 text-sm italic">
                  ❓ {m.content}
                </div>
              </div>
            );
          }
          if (m.kind === "clarify") {
            return (
              <div key={i} className="flex">
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-violet-50 border border-violet-200 text-violet-900 px-4 py-2 text-sm">
                  <span className="text-[11px] uppercase tracking-wide text-violet-500">Clarification</span>
                  <p className="mt-0.5">{m.content}</p>
                </div>
              </div>
            );
          }
          if (m.sender === "candidate") {
            answerIdx++;
            const ev = evals[answerIdx];
            let qForAnswer = "";
            for (let j = i - 1; j >= 0; j--) {
              if (messages[j].sender === "interviewer" && messages[j].kind !== "clarify") {
                qForAnswer = messages[j].content;
                break;
              }
            }
            return (
              <div key={i}>
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-violet-600 text-white px-4 py-3 leading-relaxed whitespace-pre-wrap">
                    {m.content}
                  </div>
                </div>
                {ev && <div className="mt-2">{<Scorecard ev={ev} />}</div>}
                {ev && mode === "Practice" && qForAnswer && (
                  <RetryPanel sessionId={id} question={qForAnswer} originalScore={ev.confidence_score} />
                )}
              </div>
            );
          }
          // interviewer question
          const newTerms = findTerms(m.content).filter((t) => !seen.has(t));
          newTerms.forEach((t) => seen.add(t));
          return (
            <div key={i} className="flex">
              <div className="max-w-[85%]">
                <div className="card px-4 py-3 leading-relaxed">
                  <p className="text-[11px] uppercase tracking-wide text-violet-500 mb-1">
                    Interviewer
                  </p>
                  <p className="whitespace-pre-wrap text-slate-800">{m.content}</p>
                </div>
                <TermDefs terms={newTerms} />
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error && <p className="text-rose-500 text-sm mt-2">{error}</p>}

      {/* Round summary pause (Temi §3A) */}
      {roundComplete ? (
        <div className="mt-3 card p-5">
          <div className="flex items-center gap-4">
            {roundSummary && <ScoreRing score={roundSummary.overall_confidence} size={92} label={`Round ${round}`} />}
            <div className="flex-1">
              <p className="font-semibold text-lg">🎉 Round {round} complete!</p>
              <p className="text-sm text-slate-600 mt-1">{roundSummary?.summary}</p>
              {roundSummary?.next_focus && (
                <p className="text-sm text-amber-700 mt-1">{roundSummary.next_focus}</p>
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button onClick={() => doContinue(false)} disabled={sending}
              className="px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold">
              Continue interview →
            </button>
            <span className="text-slate-400">or switch topic:</span>
            <select value={switchTopic} onChange={(e) => setSwitchTopic(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              {topics.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={() => doContinue(true)} disabled={sending}
              className="px-4 py-2 rounded-lg border border-violet-300 text-violet-700 hover:bg-violet-50 font-medium">
              Switch
            </button>
            <button onClick={finishNow} disabled={sending}
              className="ml-auto px-4 py-2 rounded-lg text-slate-500 hover:text-slate-800">
              Finish & see report
            </button>
          </div>
        </div>
      ) : status === "active" ? (
        <div className="mt-3 border-t border-slate-200 pt-3">
          {showClarify && (
            <div className="mb-2 flex gap-2">
              <input
                value={clarifyInput}
                onChange={(e) => setClarifyInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") askClarify(); }}
                placeholder="e.g. Can you give an example of what you're looking for?"
                className="flex-1 rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-sm outline-none"
              />
              <button onClick={askClarify} disabled={sending}
                className="px-3 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium disabled:opacity-50">
                Ask
              </button>
            </div>
          )}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); }}
            placeholder="Type your answer…  (Ctrl/⌘+Enter to send)"
            rows={3}
            disabled={sending}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-violet-500 resize-none"
          />
          <div className="flex justify-between items-center mt-2">
            <button onClick={() => setShowClarify((s) => !s)}
              className="text-sm text-violet-600 hover:text-violet-800">
              {showClarify ? "Hide" : "🤔 Ask a clarifying question (not scored)"}
            </button>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">
                {recorder.recording ? "🎙️ Recording… click 🎤 to stop" : transcribing ? "Transcribing…" : sending ? "Interviewer is thinking…" : `${roundSize - (qInRound || 0)} to finish round ${round}`}
              </span>
              {recorder.supported && (
                <button
                  onClick={toggleMic}
                  disabled={sending || transcribing}
                  title={recorder.recording ? "Stop & transcribe" : "Answer by voice"}
                  className={`h-10 w-10 rounded-full border flex items-center justify-center disabled:opacity-50 ${
                    recorder.recording ? "bg-rose-500 border-rose-500 text-white animate-pulse" : "border-slate-300 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {transcribing ? "…" : "🎤"}
                </button>
              )}
              <button onClick={send} disabled={sending || !input.trim()}
                className="px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold">
                Send
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-3 border-t border-slate-200 pt-3 text-center">
          <p className="text-slate-500 text-sm">Interview complete.</p>
          <a href="/dashboard" className="inline-block mt-2 text-violet-600 hover:text-violet-700 font-medium">Back to dashboard →</a>
        </div>
      )}
    </main>
  );
}

function ReportBanner({ report }: { report: Report }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-5">
        <ScoreRing score={report.overall_confidence} />
        <div className="flex-1">
          <h2 className="font-semibold text-lg">Your interview report</h2>
          <p className="mt-1 text-sm text-slate-600">{report.summary}</p>
          {report.strengths.length > 0 && (
            <p className="mt-2 text-sm"><span className="text-slate-400">Strengths: </span>{report.strengths.join(", ")}</p>
          )}
          {report.weaknesses.length > 0 && (
            <p className="text-sm"><span className="text-slate-400">Focus areas: </span>{report.weaknesses.join(", ")}</p>
          )}
          {report.next_focus && (
            <p className="mt-2 text-sm rounded-lg bg-amber-50 border border-amber-200 p-2 text-amber-900">
              🎯 {report.next_focus}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Retry a question to see if you've learned (Temi §2). Re-scores a fresh answer to the SAME
// question; does not advance the interview or affect the final report.
function RetryPanel({ sessionId, question, originalScore }: { sessionId: string; question: string; originalScore: number }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Evaluation | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await apiPost(`/sessions/${sessionId}/retry`, { question, answer: text.trim() });
      setResult(r.evaluation as Evaluation);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not score the retry.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-2 text-sm text-violet-600 hover:text-violet-800 font-medium">
        🔁 Try this question again
      </button>
    );
  }

  const delta = result ? result.confidence_score - originalScore : 0;
  return (
    <div className="mt-2 card p-4">
      <p className="text-sm font-medium text-slate-700">
        Practice this question again — see if you can raise your score (was {originalScore}/100).
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Re-answer the question with what you just learned…"
        className="mt-2 w-full rounded-lg bg-white border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 resize-none"
      />
      <div className="flex items-center gap-3 mt-2 flex-wrap">
        <button onClick={submit} disabled={busy || !text.trim()}
          className="px-4 py-1.5 rounded-lg btn-brand text-sm font-semibold disabled:opacity-50">
          {busy ? "Scoring…" : "Score my retry"}
        </button>
        <button onClick={() => { setOpen(false); setResult(null); setText(""); setErr(null); }}
          className="text-sm text-slate-500 hover:text-slate-700">
          Close
        </button>
        {result && (
          <span className="text-sm">
            New score: <b className="text-violet-700">{result.confidence_score}/100</b>{" "}
            <span className={delta >= 0 ? "text-emerald-600" : "text-rose-500"}>
              ({delta >= 0 ? "+" : ""}{delta})
            </span>
          </span>
        )}
      </div>
      {err && <p className="text-rose-500 text-sm mt-2">{err}</p>}
      {result?.to_improve && <p className="mt-2 text-sm text-amber-700">💡 {result.to_improve}</p>}
    </div>
  );
}
