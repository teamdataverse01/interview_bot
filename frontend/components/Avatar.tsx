"use client";

import { useState } from "react";

// Free, no-key interviewer avatars via DiceBear (deterministic face per persona). Falls back to
// an emoji badge if the service is blocked. Shows a "speaking" pulse when synced to TTS.

const EMOJI: Record<string, string> = {
  recruiter: "🧑‍💼",
  hiring_manager: "👩‍💼",
  technical_lead: "🧑‍💻",
  executive: "🕴️",
  netflix: "🎬",
  tiktok: "🎵",
  strava: "🏃",
  generic: "🧑‍⚖️",
};

export function Avatar({
  personaKey,
  size = 48,
  speaking = false,
}: {
  personaKey: string;
  size?: number;
  speaking?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const seed = personaKey || "interviewer";
  const url = `https://api.dicebear.com/9.x/personas/svg?seed=${encodeURIComponent(seed)}&radius=50&backgroundType=gradientLinear&backgroundColor=ede9fe,ddd6fe,f5d0fe`;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {speaking && (
        <span className="absolute -inset-1 rounded-full bg-violet-400/40 animate-ping" aria-hidden />
      )}
      <div
        className={`relative rounded-full overflow-hidden bg-violet-100 grid place-items-center ring-2 ${
          speaking ? "ring-fuchsia-500" : "ring-violet-300"
        }`}
        style={{ width: size, height: size }}
      >
        {failed ? (
          <span style={{ fontSize: size * 0.5 }}>{EMOJI[personaKey] ?? "🧑‍💼"}</span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt="Interviewer avatar"
            width={size}
            height={size}
            onError={() => setFailed(true)}
          />
        )}
      </div>
    </div>
  );
}

// Small animated "speaking…" equalizer.
export function SpeakingIndicator({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="inline-flex items-end gap-0.5 h-3" aria-label="speaking">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1 bg-fuchsia-500 rounded-full animate-pulse"
          style={{ height: `${6 + i * 3}px`, animationDelay: `${i * 120}ms` }}
        />
      ))}
    </span>
  );
}
