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
import { downloadReportPdf, downloadRoadmapPdf } from "@/lib/pdf";
import { Avatar, SpeakingIndicator } from "@/components/Avatar";
import { BrandLogo } from "@/components/BrandLogo";

export default function InterviewPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [messages, setMessages] = useState<Message[]>([]);
  const [evals, setEvals] = useState<Evaluation[]>([]);
  const [status, setStatus] = useState("active");
  const [mode, setMode] = useState("Practice");
  const [persona, setPersona] = useState("");
  const [personaName, setPersonaName] = useState("Interviewer");
  const [meta, setMeta] = useState<Record<string, string>>({});
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
  const [avatarEnabled, setAvatarEnabled] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);

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
        const pk = d.session.config.persona_key ?? "";
        setPersona(pk);
        setPersonaName(cfg.personas.find((p) => p.key === pk)?.company ?? "Interviewer");
        setMeta(d.session.config as Record<string, string>);
        setSwitchTopic(d.session.config.interview_type ?? "");
        setReport(d.session.report);
        setRoundSize(cfg.round_size ?? 4);
        setAvatarEnabled(!!cfg.avatar_enabled);
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

  async function playAvatar() {
    const lastInt = [...messages].reverse().find((m) => m.sender === "interviewer");
    if (!lastInt || avatarLoading) return;
    setAvatarLoading(true);
    setError(null);
    try {
      const r = await apiPost("/avatar/speak", { text: lastInt.content });
      setAvatarUrl(r.video_url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Avatar failed.");
    } finally {
      setAvatarLoading(false);
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
        <a href="/dashboard" className="text-sm text-violet-200 hover:text-white">← Dashboard</a>
        <div className="flex items-center gap-3 text-sm">
          <BrandLogo compact className="hidden sm:inline-flex mr-2" />
          {tts.supported && (
            <button
              onClick={toggleVoice}
              title={voiceOn ? "Turn off the interviewer's voice" : "Have the interviewer read questions aloud"}
              className={`rounded-full px-3 py-1 font-medium border ${
                voiceOn ? "bg-violet-600 text-white border-violet-600" : "border-white/20 text-violet-100 hover:bg-white/10"
              }`}
            >
                {voiceOn ? "Voice on" : "Voice"}
            </button>
          )}
          <span className="rounded-full brand-gradient text-white px-3 py-1 font-semibold shadow-sm">
            Round {round} · Q{qInRound || 1}/{roundSize}
          </span>
          <span className="text-violet-200 capitalize">{persona === "generic" ? "General" : persona} · {mode}</span>
        </div>
      </header>

      <div className="mt-3 card p-3 flex items-center gap-3">
        <Avatar personaKey={persona} size={52} speaking={tts.speaking} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white truncate">
            {personaName === "Any company (general)" ? "Your interviewer" : personaName}
          </p>
          <p className="text-xs text-violet-200 flex items-center gap-2">
            {tts.speaking ? <>Speaking <SpeakingIndicator show /></> : status === "active" ? "Listening…" : "Interview complete"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {avatarEnabled && (
            <button onClick={playAvatar} disabled={avatarLoading}
              className="text-xs rounded-full border border-white/25 text-violet-100 px-3 py-1 font-medium hover:bg-white/10 disabled:opacity-50">
              {avatarLoading ? "Rendering..." : "Live avatar"}
            </button>
          )}
          {tts.supported && !voiceOn && (
            <button onClick={toggleVoice} className="text-xs rounded-full brand-gradient text-white px-3 py-1 font-medium">
              Turn on voice
            </button>
          )}
        </div>
      </div>

      {avatarUrl && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setAvatarUrl(null)}>
          <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <video src={avatarUrl} autoPlay controls className="w-full rounded-2xl shadow-2xl" />
            <button onClick={() => setAvatarUrl(null)} className="mt-3 mx-auto block text-white/80 hover:text-white text-sm">Close</button>
          </div>
        </div>
      )}

      <div className="mt-3 flex-1 overflow-y-auto scroll-thin space-y-4 pr-1">
        {report && <ReportBanner report={report} meta={meta} />}

        {messages.map((m, i) => {
          if (m.kind === "ask") {
            return (
              <div key={i} className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-white/15 text-violet-100 px-4 py-2 text-sm italic">
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
            <div key={i} className="flex gap-2">
              <Avatar personaKey={persona} size={34} />
              <div className="max-w-[85%]">
                <div className="card px-4 py-3 leading-relaxed">
                  <p className="text-[11px] uppercase tracking-wide text-violet-500 mb-1">
                    {personaName === "Any company (general)" ? "Interviewer" : personaName}
                  </p>
                  <p className="whitespace-pre-wrap text-white">{m.content}</p>
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
              <p className="text-sm text-violet-100 mt-1">{roundSummary?.summary}</p>
              {roundSummary?.next_focus && (
                <p className="text-sm mt-2 rounded-lg bg-white/10 border border-white/15 p-2.5 text-violet-50">
                  {roundSummary.next_focus}
                </p>
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button onClick={() => doContinue(false)} disabled={sending}
              className="px-5 py-2 rounded-lg bg-violet-600 hover:bg-white disabled:opacity-50 text-white font-semibold">
              Continue interview {"->"}
            </button>
            <span className="text-violet-300">or switch topic:</span>
            <select value={switchTopic} onChange={(e) => setSwitchTopic(e.target.value)}
              className="rounded-lg border border-white/20 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm">
              {topics.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={() => doContinue(true)} disabled={sending}
              className="px-4 py-2 rounded-lg border border-violet-300 text-violet-200 hover:bg-white/10 font-medium">
              Switch
            </button>
            <button onClick={finishNow} disabled={sending}
              className="ml-auto px-4 py-2 rounded-lg text-violet-200 hover:text-white">
              Finish & see report
            </button>
          </div>
        </div>
      ) : status === "active" ? (
        <div className="mt-3 border-t border-white/15 pt-3">
          {showClarify && (
            <div className="mb-2 flex gap-2">
              <input
                value={clarifyInput}
                onChange={(e) => setClarifyInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") askClarify(); }}
                placeholder="e.g. Can you give an example of what you're looking for?"
                className="flex-1 field px-3 py-2 text-sm"
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
            className="w-full rounded-xl border border-white/20 bg-white text-slate-900 placeholder:text-slate-400 px-4 py-3 outline-none focus:border-violet-500 resize-none"
          />
          <div className="flex justify-between items-center mt-2">
            <button onClick={() => setShowClarify((s) => !s)}
              title="Ask the interviewer to clarify — this is never scored"
              className="text-sm rounded-lg border border-white/25 text-violet-100 px-3 py-1.5 font-medium hover:bg-white/10">
              {showClarify ? "Hide clarification" : "Ask a clarifying question"}
            </button>
            <div className="flex items-center gap-3">
              <span className="text-xs text-violet-300">
                {recorder.recording ? "Recording... click mic to stop" : transcribing ? "Transcribing..." : sending ? "Interviewer is thinking..." : `${roundSize - (qInRound || 0)} to finish round ${round}`}
              </span>
              {recorder.supported && (
                <button
                  onClick={toggleMic}
                  disabled={sending || transcribing}
                  title={recorder.recording ? "Stop & transcribe" : "Answer by voice"}
                  className={`h-10 w-10 rounded-full border flex items-center justify-center disabled:opacity-50 ${
                    recorder.recording ? "bg-rose-500 border-rose-500 text-white animate-pulse" : "border-white/20 text-violet-100 hover:bg-white/10"
                  }`}
                >
                  {transcribing ? "..." : "Mic"}
                </button>
              )}
              <button onClick={send} disabled={sending || !input.trim()}
                className="px-5 py-2 rounded-lg bg-violet-600 hover:bg-white disabled:opacity-50 text-white font-semibold">
                Send
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-3 border-t border-white/15 pt-3 text-center">
          <p className="text-violet-200 text-sm">Interview complete.</p>
          <a href="/dashboard" className="inline-block mt-2 text-violet-600 hover:text-violet-200 font-medium">Back to dashboard →</a>
        </div>
      )}
    </main>
  );
}

const REC_STYLES: Record<string, string> = {
  "strong hire": "bg-emerald-100 text-emerald-800 border-emerald-300",
  "hire": "bg-green-100 text-green-800 border-green-300",
  "hire with reservations": "bg-amber-100 text-amber-800 border-amber-300",
  "no hire": "bg-rose-100 text-rose-800 border-rose-300",
};

function ReportBanner({ report, meta }: { report: Report; meta: Record<string, string> }) {
  const rec = report.recommendation || "";
  const recStyle = REC_STYLES[rec.toLowerCase()] || "bg-violet-100 text-violet-800 border-violet-300";
  const [speaking, setSpeaking] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const metaArg = {
    role: meta.role, level: meta.level, interview_type: meta.interview_type,
    difficulty: meta.difficulty, persona: meta.persona_key,
  };
  async function makePdf(fn: (r: Report, m: typeof metaArg) => Promise<void>) {
    setPdfError(null);
    try {
      await fn(report, metaArg);
    } catch (e) {
      setPdfError("Couldn't create the PDF: " + (e instanceof Error ? e.message : "unknown error"));
    }
  }

  function speakDebrief() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const parts = [
      report.debrief_intro,
      rec ? `My recommendation: ${rec}.` : "",
      report.did_well?.length ? "What you did well: " + report.did_well.join(". ") : "",
      report.held_back?.length ? "What held you back: " + report.held_back.join(". ") : "",
      report.how_to_improve?.length ? "How to improve: " + report.how_to_improve.join(". ") : "",
      report.absolute_hire ? "To become an absolute hire: " + report.absolute_hire : "",
    ].filter(Boolean).join(" ");
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(parts);
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  }

  // Fallback if the LLM debrief didn't generate.
  const hasDebrief = !!(rec || report.did_well?.length || report.held_back?.length);

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Avatar personaKey={meta.persona_key || "generic"} size={52} speaking={speaking} />
          <div>
            <p className="text-xs uppercase tracking-wide text-violet-300">Hiring manager debrief</p>
            {rec && (
              <span className={`mt-1 inline-block rounded-full border px-4 py-1.5 text-lg font-bold ${recStyle}`}>
                {rec}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={speakDebrief}
            className="rounded-lg border border-violet-300 text-violet-200 px-3 py-1.5 text-sm font-medium hover:bg-white/10">
            🔊 Hear your debrief
          </button>
          <button onClick={() => makePdf(downloadReportPdf)}
            className="rounded-lg btn-brand px-3 py-1.5 text-sm font-semibold">
            ⬇ Report PDF
          </button>
          <button onClick={() => makePdf(downloadRoadmapPdf)}
            className="rounded-lg border border-violet-300 text-violet-200 px-3 py-1.5 text-sm font-medium hover:bg-white/10">
            🗺️ Roadmap
          </button>
        </div>
      </div>
      {pdfError && <p className="mt-2 text-sm text-rose-300">{pdfError}</p>}

      {report.debrief_intro && <p className="mt-3 text-violet-100 leading-relaxed">{report.debrief_intro}</p>}

      {!hasDebrief && <p className="mt-3 text-sm text-violet-100">{report.summary}</p>}

      {report.did_well?.length ? (
        <DebriefList title="✅ What you did well" items={report.did_well} tone="emerald" />
      ) : null}
      {report.held_back?.length ? (
        <DebriefList title="⚠️ What held you back" items={report.held_back} tone="amber" />
      ) : null}
      {report.how_to_improve?.length ? (
        <DebriefList title="🚀 How to improve" items={report.how_to_improve} tone="violet" />
      ) : null}

      {report.absolute_hire && (
        <div className="mt-4 rounded-lg bg-white/10 border border-white/20 p-3">
          <p className="font-semibold text-fuchsia-200">🌟 What would make you an absolute hire</p>
          <p className="mt-1 text-sm text-violet-50">{report.absolute_hire}</p>
        </div>
      )}
    </div>
  );
}

function DebriefList({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  const dot: Record<string, string> = { emerald: "text-emerald-500", amber: "text-amber-500", violet: "text-violet-500" };
  return (
    <div className="mt-4">
      <p className="font-semibold text-white">{title}</p>
      <ul className="mt-1 space-y-1">
        {items.map((it, i) => (
          <li key={i} className="text-sm text-violet-100 flex gap-2">
            <span className={dot[tone] || "text-violet-300"}>•</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
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
      <button onClick={() => setOpen(true)}
        className="mt-2 text-sm rounded-lg border border-white/25 text-violet-100 px-3 py-1.5 font-medium hover:bg-white/10">
        Try this question again
      </button>
    );
  }

  const delta = result ? result.confidence_score - originalScore : 0;
  return (
    <div className="mt-2 card p-4">
      <p className="text-sm font-medium text-violet-100">
        Practice this question again — see if you can raise your score (was {originalScore}/100).
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Re-answer the question with what you just learned…"
        className="mt-2 w-full rounded-lg bg-white text-slate-900 placeholder:text-slate-400 border border-white/20 px-3 py-2 outline-none focus:border-violet-500 resize-none"
      />
      <div className="flex items-center gap-3 mt-2 flex-wrap">
        <button onClick={submit} disabled={busy || !text.trim()}
          className="px-4 py-1.5 rounded-lg btn-brand text-sm font-semibold disabled:opacity-50">
          {busy ? "Scoring…" : "Score my retry"}
        </button>
        <button onClick={() => { setOpen(false); setResult(null); setText(""); setErr(null); }}
          className="text-sm text-violet-200 hover:text-violet-100">
          Close
        </button>
        {result && (
          <span className="text-sm">
            New score: <b className="text-violet-200">{result.confidence_score}/100</b>{" "}
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
