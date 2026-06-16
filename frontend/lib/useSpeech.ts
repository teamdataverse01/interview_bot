"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Voice via the browser Web Speech API — zero backend, zero cost, no API keys.
 * - Text-to-speech (interviewer reads questions aloud): works in all modern browsers.
 * - Speech-to-text (answer by voice): Chrome / Edge / Safari (webkit). Gracefully hidden elsewhere.
 *
 * Upgrade path for production quality / full cross-browser: record with MediaRecorder and POST to a
 * backend `/transcribe` using Groq whisper-large-v3 (free tier), and use ElevenLabs for TTS.
 */

// The Web Speech API isn't in the standard TS DOM lib, so we access it loosely.
function getRecognitionCtor(): (new () => unknown) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition || w.webkitSpeechRecognition || null) as (new () => unknown) | null;
}

export function useSpeechRecognition() {
  const [supported] = useState(() => !!getRecognitionCtor());
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);
  const finalRef = useRef("");

  const stop = useCallback(() => {
    try { recRef.current?.stop(); } catch { /* noop */ }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec: any = new (Ctor as any)();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    finalRef.current = "";
    setTranscript("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalRef.current += res[0].transcript;
        else interim += res[0].transcript;
      }
      setTranscript((finalRef.current + interim).replace(/\s+/g, " ").trim());
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch { setListening(false); }
  }, []);

  useEffect(() => () => { try { recRef.current?.abort?.(); } catch { /* noop */ } }, []);

  return { supported, listening, transcript, start, stop };
}

/**
 * Audio recorder for cross-browser voice answers. Records with MediaRecorder, then the clip is
 * uploaded to the backend `/transcribe` (Groq Whisper). Works in Chrome, Edge, Firefox, Safari.
 */
export function useAudioRecorder() {
  const [supported] = useState(
    () =>
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof window !== "undefined" &&
      "MediaRecorder" in window
  );
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const resolveRef = useRef<((b: Blob) => void) | null>(null);

  const start = useCallback(async () => {
    if (!supported) throw new Error("Recording not supported in this browser.");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const mime = ["audio/webm", "audio/mp4", "audio/ogg"].find(
      (m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)
    );
    const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    chunksRef.current = [];
    mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
      streamRef.current?.getTracks().forEach((t) => t.stop());
      setRecording(false);
      resolveRef.current?.(blob);
    };
    recorderRef.current = mr;
    mr.start();
    setRecording(true);
  }, [supported]);

  const stop = useCallback(
    () =>
      new Promise<Blob>((resolve) => {
        resolveRef.current = resolve;
        recorderRef.current?.stop();
      }),
    []
  );

  return { supported, recording, start, stop };
}

export function useTextToSpeech() {
  const [supported] = useState(
    () => typeof window !== "undefined" && "speechSynthesis" in window
  );
  const [speaking, setSpeaking] = useState(false);

  const speak = useCallback(
    (text: string) => {
      if (!supported || !text) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1;
      u.pitch = 1;
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      setSpeaking(true);
      window.speechSynthesis.speak(u);
    },
    [supported]
  );

  const stop = useCallback(() => {
    if (supported) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    }
  }, [supported]);

  return { supported, speaking, speak, stop };
}
