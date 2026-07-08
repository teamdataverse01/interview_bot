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
  const logoSize = compact ? 62 : 88;
  const shellTone = tone === "light"
    ? "ring-white/35 bg-white/14 shadow-[0_22px_52px_-28px_rgba(245,158,255,0.9)]"
    : "ring-violet-300/70 bg-violet-50 shadow-[0_16px_36px_-22px_rgba(109,40,217,0.45)]";

  return (
    <div className={`inline-flex items-center ${className}`.trim()}>
      <div className={`relative overflow-hidden rounded-[1.45rem] ring-1 ${shellTone}`}>
        <Image
          src="/dataverse-logo.png"
          alt="Dataverse logo"
          width={logoSize}
          height={logoSize}
          className="h-auto w-auto scale-[1.03]"
          priority
        />
      </div>
    </div>
  );
}
