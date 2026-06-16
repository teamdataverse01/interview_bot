import { DIMENSION_LABELS, PRINCIPLE_LABELS, type Evaluation } from "@/lib/types";

function barColor(v: number) {
  if (v >= 8) return "bg-emerald-500";
  if (v >= 6) return "bg-amber-500";
  return "bg-rose-500";
}

export function Scorecard({ ev }: { ev: Evaluation }) {
  return (
    <div className="card p-4 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-slate-700">Feedback</span>
        <span className="text-slate-600">
          Interview Readiness{" "}
          <b className="text-xl text-sky-600">{ev.confidence_score}</b>
          <span className="text-slate-400">/100</span>
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
        {Object.entries(ev.scores).map(([k, v]) => (
          <div key={k} className="flex items-center gap-2">
            <span className="w-28 shrink-0 text-slate-500 text-xs">{DIMENSION_LABELS[k] ?? k}</span>
            <div className="flex-1 h-2 rounded bg-slate-100 overflow-hidden">
              <div className={`h-full ${barColor(v)}`} style={{ width: `${v * 10}%` }} />
            </div>
            <span className="w-5 text-right text-xs tabular-nums text-slate-600">{v}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {Object.entries(ev.principles).map(([k, hit]) => (
          <span
            key={k}
            className={`px-2 py-0.5 rounded-full text-xs border ${
              hit
                ? "border-emerald-300 text-emerald-700 bg-emerald-50"
                : "border-slate-200 text-slate-400 bg-slate-50"
            }`}
            title={hit ? "Demonstrated" : "Missing"}
          >
            {hit ? "✓" : "○"} {PRINCIPLE_LABELS[k] ?? k}
          </span>
        ))}
      </div>

      {ev.to_improve && (
        <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-amber-900">
          <span className="font-medium">What gets this closer to 100: </span>
          {ev.to_improve}
        </div>
      )}

      {ev.missed_concepts?.length > 0 && (
        <p className="mt-3 text-slate-600">
          <span className="text-slate-400">Missed: </span>
          {ev.missed_concepts.join(", ")}
        </p>
      )}
      {ev.stronger_answer && (
        <details className="mt-2 group">
          <summary className="cursor-pointer text-sky-600 font-medium">💪 Stronger answer</summary>
          <p className="mt-1 text-slate-700">{ev.stronger_answer}</p>
        </details>
      )}
      {ev.star_notes && (
        <details className="mt-1">
          <summary className="cursor-pointer text-sky-600 font-medium">⭐ STAR optimization</summary>
          <p className="mt-1 text-slate-700">{ev.star_notes}</p>
        </details>
      )}
    </div>
  );
}
