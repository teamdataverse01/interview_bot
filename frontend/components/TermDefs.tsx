import { GLOSSARY } from "@/lib/glossary";

// Small definition chips shown under a question for any acronyms appearing for the first time.
export function TermDefs({ terms }: { terms: string[] }) {
  if (!terms.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {terms.map((t) => (
        <span
          key={t}
          title={GLOSSARY[t]}
          className="cursor-help rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] text-sky-700"
        >
          {t} <span className="opacity-60">ⓘ</span>
        </span>
      ))}
    </div>
  );
}
