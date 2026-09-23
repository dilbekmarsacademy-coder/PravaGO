"use client";

import { ArrowRightIcon, CarFrontIcon, IdCardLanyardIcon, OctagonAlertIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/useLocale";
import { useReveal } from "./useReveal";
import type { ExamStatus } from "./types";

interface CategorySectionProps {
  onSelect: (status: ExamStatus) => void;
}

const ICONS: Record<ExamStatus, typeof CarFrontIcon> = {
  "first-time": CarFrontIcon,
  "failed-before": OctagonAlertIcon,
  "license-revoked": IdCardLanyardIcon,
};

const STYLES: Record<
  ExamStatus,
  { color: string; ring: string; glow: string }
> = {
  "first-time": {
    color: "text-neon-green",
    ring: "bg-neon-green/10",
    glow: "hover:border-neon-green/50 hover:shadow-[0_0_30px_-10px_rgba(34,255,156,0.5)]",
  },
  "failed-before": {
    color: "text-neon-amber",
    ring: "bg-neon-amber/10",
    glow: "hover:border-neon-amber/50 hover:shadow-[0_0_30px_-10px_rgba(255,192,34,0.5)]",
  },
  "license-revoked": {
    color: "text-neon-red",
    ring: "bg-neon-red/10",
    glow: "hover:border-neon-red/50 hover:shadow-[0_0_30px_-10px_rgba(255,59,92,0.5)]",
  },
};

export default function CategorySection({ onSelect }: CategorySectionProps) {
  const { ref, visible } = useReveal<HTMLDivElement>();
  const { t } = useLocale();

  return (
    <section className="px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {t.categorySection.heading}
        </h2>

        <div
          ref={ref}
          className={cn(
            "reveal mt-9 grid gap-4 sm:grid-cols-3",
            visible && "reveal-visible",
          )}
        >
          {t.examStatusOptions.map((option) => {
            const Icon = ICONS[option.value];
            const style = STYLES[option.value];
            return (
              <div
                key={option.value}
                className={cn(
                  "glass group flex flex-col gap-4 rounded-2xl p-6 transition-all duration-300",
                  style.glow,
                )}
              >
                <span className={cn("flex size-10 items-center justify-center rounded-full", style.ring, style.color)}>
                  <Icon className="size-5" />
                </span>
                <div>
                  <h3 className="font-display text-lg font-bold text-foreground">
                    {option.title}
                  </h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{option.desc}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onSelect(option.value)}
                  className={cn(
                    "mt-1 inline-flex items-center gap-1.5 self-start text-sm font-semibold transition-transform group-hover:translate-x-0.5",
                    style.color,
                  )}
                >
                  {t.categorySection.cta}
                  <ArrowRightIcon className="size-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
