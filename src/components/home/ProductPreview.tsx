"use client";

import { CheckIcon, GaugeIcon, IdCardIcon, RouteIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useReveal } from "./useReveal";

const CHECKLIST = [
  "Mavzuli video darslar",
  "1 260 ta rasmiy savol",
  "Avtomatik natija nazorati",
  "Qayta ishlash imkoniyati",
  "Yakuniy ichki imtihon",
];

// NOTE: Hardcoded mock numbers for UI preview functionality — real hisob-kitob emas.
const DEMO_DAY_PROGRESS = 4;
const DEMO_DAY_TOTAL = 7;
const DEMO_TICKETS = "63";
const DEMO_LAST_SCORE = "92%";

const RING_RADIUS = 42;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const RING_PROGRESS = DEMO_DAY_PROGRESS / DEMO_DAY_TOTAL;

interface ProductPreviewProps {
  onStart: () => void;
}

export default function ProductPreview({ onStart }: ProductPreviewProps) {
  const { ref, visible } = useReveal<HTMLDivElement>();

  return (
    <section id="dastur" className="scroll-mt-20 px-5 py-16 sm:px-8">
      <div
        ref={ref}
        className={cn(
          "reveal mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 lg:items-center lg:gap-16",
          visible && "reveal-visible",
        )}
      >
        <div>
          <span className="flex size-10 items-center justify-center rounded-full bg-white/5 text-neon-cyan">
            <RouteIcon className="size-5" />
          </span>
          <span className="mt-4 block font-mono text-xs tracking-[0.24em] text-neon-cyan uppercase">
            Platforma
          </span>
          <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Hamma narsa bir joyda
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
            Video darsdan tortib yakuniy ichki imtihongacha — butun tayyorgarlik
            jarayoni bitta shaxsiy kabinetda, aniq bosqichlar bilan boshqariladi.
          </p>

          <ul className="mt-6 flex flex-col gap-3">
            {CHECKLIST.map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-sm text-foreground/90">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-neon-orange/15 text-neon-orange">
                  <CheckIcon className="size-3" />
                </span>
                {item}
              </li>
            ))}
          </ul>

          <Button
            onClick={onStart}
            className="glow-orange-hover mt-8 h-auto rounded-full border-0 bg-gradient-to-r from-neon-orange to-neon-orange-2 px-6 py-3 text-sm font-bold text-background"
          >
            Tayyorlanishni boshlash
          </Button>
        </div>

        <div className="glass rounded-2xl p-6 sm:p-7">
          <div className="flex items-center justify-between">
            <span className="text-xs tracking-wide text-muted-foreground uppercase">
              Shaxsiy kabinet
            </span>
            <span className="rounded-full bg-white/5 px-2.5 py-1 font-mono text-[0.65rem] text-neon-green">
              ONLINE
            </span>
          </div>

          <div className="mt-6 flex items-center gap-5">
            <div className="relative size-28 shrink-0">
              <svg viewBox="0 0 100 100" className="size-28 -rotate-90">
                <circle
                  cx="50"
                  cy="50"
                  r={RING_RADIUS}
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r={RING_RADIUS}
                  fill="none"
                  stroke="url(#preview-ring-gradient)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={RING_CIRCUMFERENCE}
                  strokeDashoffset={RING_CIRCUMFERENCE * (1 - RING_PROGRESS)}
                />
                <defs>
                  <linearGradient id="preview-ring-gradient" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#ff5e00" />
                    <stop offset="100%" stopColor="#00e5ff" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-xl font-bold text-foreground tabular-nums">
                  {DEMO_DAY_PROGRESS}/{DEMO_DAY_TOTAL}
                </span>
                <span className="text-[0.65rem] tracking-wide text-muted-foreground uppercase">
                  kun
                </span>
              </div>
            </div>

            <div className="flex-1 rounded-xl border border-border bg-white/[0.03] p-4">
              <span className="text-xs tracking-wide text-neon-orange uppercase">
                Bugungi vazifa
              </span>
              <p className="mt-1.5 font-display text-sm font-bold text-foreground">
                5-mavzu: Chorrahalarda harakatlanish
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Video dars + 20 savollik test
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-white/[0.03] p-4">
              <IdCardIcon className="size-4 text-neon-orange" />
              <p className="mt-2 font-mono text-xl font-bold text-foreground tabular-nums">
                {DEMO_TICKETS}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">Bilet</p>
            </div>
            <div className="rounded-xl border border-border bg-white/[0.03] p-4">
              <GaugeIcon className="size-4 text-neon-cyan" />
              <p className="mt-2 font-mono text-xl font-bold text-foreground tabular-nums">
                {DEMO_LAST_SCORE}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">Oxirgi natija</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
