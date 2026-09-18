const BADGES = [
  { value: "63", label: "bilet", rotate: "-rotate-3" },
  { value: "1 260", label: "savol", rotate: "rotate-2" },
  { value: "98%", label: "tayyorgarlik talabi", rotate: "-rotate-2" },
];

export default function TrustBadges() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-5 sm:gap-8">
      {BADGES.map((badge) => (
        <div
          key={badge.label}
          className={`flex size-28 flex-col items-center justify-center gap-1 rounded-full border-2 border-dashed border-signal/80 text-center ${badge.rotate}`}
        >
          <span className="font-mono text-xl font-bold text-signal sm:text-2xl">
            {badge.value}
          </span>
          <span className="max-w-20 text-[0.65rem] leading-tight uppercase tracking-[0.08em] text-paper/70">
            {badge.label}
          </span>
        </div>
      ))}
    </div>
  );
}
