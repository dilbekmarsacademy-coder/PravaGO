"use client";

import { CheckIcon, RocketIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/useLocale";
import { useReveal } from "./useReveal";

interface PricingProps {
  onStart: () => void;
}

const HIGHLIGHTED_INDEX = 1;

export default function Pricing({ onStart }: PricingProps) {
  const { ref, visible } = useReveal<HTMLDivElement>();
  const { t } = useLocale();

  return (
    <section id="narxlar" className="scroll-mt-20 px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <span className="font-mono text-xs tracking-[0.24em] text-neon-orange uppercase">
            {t.pricing.eyebrow}
          </span>
          <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t.pricing.heading}
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t.pricing.desc}
          </p>
        </div>

        <div
          ref={ref}
          className={cn(
            "reveal mt-12 grid gap-5 sm:grid-cols-3",
            visible && "reveal-visible",
          )}
        >
          {t.pricing.plans.map((plan, i) => {
            const highlighted = i === HIGHLIGHTED_INDEX;
            return (
              <div
                key={plan.name}
                className={cn(
                  "glass relative flex flex-col rounded-2xl p-6 transition-all duration-300",
                  highlighted
                    ? "border-neon-orange/50 shadow-[0_0_40px_-12px_rgba(255,94,0,0.5)]"
                    : "hover:border-neon-cyan/40",
                )}
              >
                {highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-neon-orange to-neon-orange-2 px-3 py-1 font-mono text-[0.65rem] font-bold tracking-wide text-background uppercase">
                    {t.pricing.ommabop}
                  </span>
                )}

                <h3 className="font-display text-lg font-bold text-foreground">
                  {plan.name}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">{plan.desc}</p>

                <div className="mt-5 flex items-baseline gap-1.5">
                  <span className="font-mono text-3xl font-bold tracking-tight text-foreground tabular-nums">
                    {plan.price}
                  </span>
                  <span className="text-sm text-muted-foreground">{t.pricing.somLabel}</span>
                </div>
                <span className="mt-0.5 text-xs text-muted-foreground">
                  {plan.periodLabel}
                </span>

                <ul className="mt-6 flex flex-1 flex-col gap-2.5">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-center gap-2.5 text-sm text-foreground/90"
                    >
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-neon-orange/15 text-neon-orange">
                        <CheckIcon className="size-3" />
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={onStart}
                  className={cn(
                    "mt-7 h-auto rounded-full border-0 px-6 py-3 text-sm font-bold",
                    highlighted
                      ? "glow-orange-hover bg-gradient-to-r from-neon-orange to-neon-orange-2 text-background"
                      : "border border-border bg-transparent text-foreground hover:border-neon-cyan/50 hover:text-neon-cyan",
                  )}
                >
                  {t.pricing.tanlash}
                  <RocketIcon className="size-4" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
