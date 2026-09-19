"use client";

import { FlagIcon, TargetIcon, TrophyIcon, ZapIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReveal } from "./useReveal";

const STATS = [
  {
    icon: FlagIcon,
    value: "63",
    unit: "BILET",
    desc: "To'liq yangilangan bazasi",
    glow: "group-hover:shadow-[0_0_30px_-8px_rgba(255,94,0,0.5)] group-hover:border-neon-orange/40",
  },
  {
    icon: TargetIcon,
    value: "1 260",
    unit: "SAVOL",
    desc: "Rasmiy YHXBB imtihon bazasi",
    glow: "group-hover:shadow-[0_0_30px_-8px_rgba(0,229,255,0.5)] group-hover:border-neon-cyan/40",
  },
  {
    icon: ZapIcon,
    value: "6+1",
    unit: "KUN",
    desc: "Bosqichma-bosqich tezlashtirilgan tizim",
    glow: "group-hover:shadow-[0_0_30px_-8px_rgba(255,94,0,0.5)] group-hover:border-neon-orange/40",
  },
  {
    icon: TrophyIcon,
    value: "98%",
    unit: "PASSRATE",
    desc: "Keyingi bosqichga o'tish talabi",
    glow: "group-hover:shadow-[0_0_30px_-8px_rgba(0,229,255,0.5)] group-hover:border-neon-cyan/40",
  },
];

export default function TrustStats() {
  const { ref, visible } = useReveal<HTMLDivElement>();

  return (
    <section
      id="natijalar"
      className="relative scroll-mt-20 border-y border-border px-5 py-14 sm:px-8"
    >
      <div
        ref={ref}
        className={cn(
          "reveal mx-auto grid max-w-5xl grid-cols-2 gap-4 md:grid-cols-4",
          visible && "reveal-visible",
        )}
      >
        {STATS.map((stat) => (
          <div
            key={stat.unit}
            className={cn(
              "glass group flex flex-col gap-3 rounded-2xl px-5 py-6 transition-all duration-300",
              stat.glow,
            )}
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-white/5 text-neon-orange">
              <stat.icon className="size-4.5" />
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-2xl font-bold tracking-tight text-foreground tabular-nums sm:text-3xl">
                {stat.value}
              </span>
              <span className="font-mono text-xs font-semibold tracking-widest text-foreground/80 uppercase">
                {stat.unit}
              </span>
            </div>
            <span className="text-xs leading-snug text-muted-foreground">{stat.desc}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
