// Large circular score meter — makes the readiness score the focal point (Temi §2B).
export function ScoreRing({
  score,
  size = 132,
  label = "Interview Readiness",
}: {
  score: number;
  size?: number;
  label?: string;
}) {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const offset = c - (pct / 100) * c;
  const color = pct >= 80 ? "#10b981" : pct >= 60 ? "#f59e0b" : pct >= 40 ? "#fb923c" : "#f43f5e";

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} stroke="#e5e7eb" strokeWidth={stroke} fill="none" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.8s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold" style={{ color }}>{pct}</span>
          <span className="text-xs text-violet-200/70">/ 100</span>
        </div>
      </div>
      <span className="mt-2 text-sm font-medium text-violet-100">{label}</span>
    </div>
  );
}
