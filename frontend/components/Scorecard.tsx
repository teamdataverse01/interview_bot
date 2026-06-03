import { DIMENSION_LABELS, PRINCIPLE_LABELS, type Evaluation } from "@/lib/types";

function barColor(v: number) {
  if (v >= 8) return "bg-emerald-500";
  if (v >= 6) return "bg-amber-500";
  return "bg-rose-500";
}

export function Scorecard({ ev }: { ev: Evaluation }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sky-300">Evaluation</span>
        <span className="text-slate-200">
          Confidence <b className="text-lg">{ev.confidence_score}</b>/100
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
        {Object.entries(ev.scores).map(([k, v]) => (
          <div key={k} className="flex items-center gap-2">
            <span className="w-28 shrink-0 text-slate-400 text-xs">{DIMENSION_LABELS[k] ?? k}</span>
            <div className="flex-1 h-2 rounded bg-slate-800 overflow-hidden">
              <div className={`h-full ${barColor(v)}`} style={{ width: `${v * 10}%` }} />
            </div>
            <span className="w-5 text-right text-xs tabular-nums">{v}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {Object.entries(ev.principles).map(([k, hit]) => (
          <span
            key={k}
            className={`px-2 py-0.5 rounded-full text-xs border ${
              hit
                ? "border-emerald-600 text-emerald-300 bg-emerald-950/40"
                : "border-slate-700 text-slate-500"
            }`}
            title={hit ? "Demonstrated" : "Missing"}
          >
            {hit ? "✓" : "○"} {PRINCIPLE_LABELS[k] ?? k}
          </span>
        ))}
      </div>

      {ev.missed_concepts?.length > 0 && (
        <p className="mt-3 text-slate-300">
          <span className="text-slate-500">Missed: </span>
          {ev.missed_concepts.join(", ")}
        </p>
      )}
      {ev.stronger_answer && (
        <details className="mt-2">
          <summary className="cursor-pointer text-sky-300">Stronger answer</summary>
          <p className="mt-1 text-slate-300">{ev.stronger_answer}</p>
        </details>
      )}
      {ev.star_notes && (
        <details className="mt-1">
          <summary className="cursor-pointer text-sky-300">STAR optimization</summary>
          <p className="mt-1 text-slate-300">{ev.star_notes}</p>
        </details>
      )}
    </div>
  );
}
