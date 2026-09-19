"use client";

import { ArrowRightIcon, CarFrontIcon, IdCardLanyardIcon, OctagonAlertIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReveal } from "./useReveal";
import type { ExamStatus } from "./types";

interface CategorySectionProps {
  onSelect: (status: ExamStatus) => void;
}

const OPTIONS: {
  value: ExamStatus;
  icon: typeof CarFrontIcon;
  title: string;
  desc: string;
  color: string;
  ring: string;
  glow: string;
}[] = [
  {
    value: "first-time",
    icon: CarFrontIcon,
    title: "Birinchi marta topshiraman",
    desc: "Hali imtihonga kirmaganman.",
    color: "text-neon-green",
    ring: "bg-neon-green/10",
    glow: "hover:border-neon-green/50 hover:shadow-[0_0_30px_-10px_rgba(34,255,156,0.5)]",
  },
  {
    value: "failed-before",
    icon: OctagonAlertIcon,
    title: "Oldin imtihondan yiqilganman",
    desc: "Qayta tayyorlanmoqchiman.",
    color: "text-neon-amber",
    ring: "bg-neon-amber/10",
    glow: "hover:border-neon-amber/50 hover:shadow-[0_0_30px_-10px_rgba(255,192,34,0.5)]",
  },
  {
    value: "license-revoked",
    icon: IdCardLanyardIcon,
    title: "Guvohnomam bekor qilingan",
    desc: "Qayta imtihonga tayyorlanyapman.",
    color: "text-neon-red",
    ring: "bg-neon-red/10",
    glow: "hover:border-neon-red/50 hover:shadow-[0_0_30px_-10px_rgba(255,59,92,0.5)]",
  },
];

export default function CategorySection({ onSelect }: CategorySectionProps) {
  const { ref, visible } = useReveal<HTMLDivElement>();

  return (
    <section className="px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Siz qaysi holatdasiz?
        </h2>

        <div
          ref={ref}
          className={cn(
            "reveal mt-9 grid gap-4 sm:grid-cols-3",
            visible && "reveal-visible",
          )}
        >
          {OPTIONS.map((option) => (
            <div
              key={option.value}
              className={cn(
                "glass group flex flex-col gap-4 rounded-2xl p-6 transition-all duration-300",
                option.glow,
              )}
            >
              <span className={cn("flex size-10 items-center justify-center rounded-full", option.ring, option.color)}>
                <option.icon className="size-5" />
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
                  option.color,
                )}
              >
                Men uchun
                <ArrowRightIcon className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
