"use client";

import { BookOpenCheckIcon, FlagIcon, GaugeIcon, ListChecksIcon, VideoIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/useLocale";
import { useReveal } from "./useReveal";

const ICONS = [VideoIcon, ListChecksIcon, GaugeIcon, BookOpenCheckIcon, FlagIcon];

export default function HowItWorks() {
  const { ref, visible } = useReveal<HTMLDivElement>();
  const { t } = useLocale();

  return (
    <section id="qanday-ishlaydi" className="scroll-mt-20 px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <span className="font-mono text-xs tracking-[0.24em] text-neon-orange uppercase">
            {t.howItWorks.eyebrow}
          </span>
          <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t.howItWorks.heading}
          </h2>
        </div>

        <div
          ref={ref}
          className={cn(
            "reveal relative mt-14 flex flex-col gap-8 sm:flex-row sm:items-start sm:gap-3",
            visible && "reveal-visible",
          )}
        >
          {/* Race track chizig'i (desktop) */}
          <div
            className="pointer-events-none absolute top-6 right-[8%] left-[8%] hidden h-px sm:block"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, var(--neon-orange) 0, var(--neon-orange) 14px, transparent 14px, transparent 26px)",
              opacity: 0.5,
            }}
            aria-hidden="true"
          />

          {t.howItWorks.steps.map((step, i) => {
            const Icon = ICONS[i];
            return (
              <div
                key={step.title}
                className="relative flex flex-1 items-start gap-4 sm:flex-col sm:items-center sm:text-center"
              >
                <div className="flex flex-col items-center sm:w-full sm:flex-row sm:justify-center">
                  <span className="glass glow-orange-hover relative flex size-12 shrink-0 items-center justify-center rounded-full text-neon-orange">
                    <Icon className="size-5" />
                    <span className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-gradient-to-br from-neon-orange to-neon-orange-2 font-mono text-[0.6rem] font-bold text-background tabular-nums">
                      {i + 1}
                    </span>
                  </span>
                  {i < t.howItWorks.steps.length - 1 && (
                    <span
                      className="mt-2 h-full w-px flex-1 border-l border-dashed border-border sm:hidden"
                      aria-hidden="true"
                    />
                  )}
                </div>
                <div className="pb-6 sm:pb-0">
                  <h3 className="font-display text-sm font-bold text-foreground sm:text-base">
                    {step.title}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
