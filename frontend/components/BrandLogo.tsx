import Image from "next/image";

export function BrandLogo({
  compact = false,
  tone = "light",
  className = "",
}: {
  compact?: boolean;
  tone?: "light" | "dark";
  className?: string;
}) {
  const textTone = tone === "light" ? "text-white" : "text-zinc-900";
  const subTone = tone === "light" ? "text-violet-200/90" : "text-violet-700";

  return (
    <div className={`inline-flex items-center ${compact ? "gap-2.5" : "gap-3"} ${className}`.trim()}>
      <div className={`relative overflow-hidden rounded-xl ring-1 ${tone === "light" ? "ring-white/20 bg-white/10" : "ring-violet-200 bg-violet-50"}`}>
        <Image
          src="/dataverse-logo.png"
          alt="Dataverse logo"
          width={compact ? 36 : 42}
          height={compact ? 36 : 42}
          className="h-auto w-auto"
          priority
        />
      </div>
      <div>
        <p className={`leading-none font-semibold tracking-[0.14em] uppercase text-[10px] ${subTone}`}>
          Dataverse
        </p>
        {!compact && <p className={`leading-tight mt-1 font-semibold text-[15px] ${textTone}`}>AI Interview Coach</p>}
      </div>
    </div>
  );
}
