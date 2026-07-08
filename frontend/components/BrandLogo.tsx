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
  const logoSize = compact ? 48 : 64;

  return (
    <div className={`inline-flex items-center ${compact ? "gap-3" : "gap-4"} ${className}`.trim()}>
      <div className={`relative overflow-hidden rounded-2xl ring-1 ${tone === "light" ? "ring-white/25 bg-white/12" : "ring-violet-200 bg-violet-50"}`}>
        <Image
          src="/dataverse-logo.png"
          alt="Dataverse logo"
          width={logoSize}
          height={logoSize}
          className="h-auto w-auto"
          priority
        />
      </div>
      <div>
        <p className={`leading-none font-semibold tracking-[0.14em] uppercase ${compact ? "text-[10px]" : "text-[11px]"} ${subTone}`}>
          Dataverse
        </p>
        {!compact && <p className={`leading-tight mt-1.5 font-semibold text-[18px] ${textTone}`}>AI Interview Coach</p>}
      </div>
    </div>
  );
}
