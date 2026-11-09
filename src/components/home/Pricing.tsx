"use client";

import Link from "next/link";
import { ArrowRightIcon, CheckIcon, GiftIcon, RocketIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { TARIFFS, TARIFF_RULES, formatPrice, type Tariff } from "@/config/tariffs";
import type { Dictionary } from "@/lib/i18n/dictionary";
import DurationSwitch from "@/components/tariffs/DurationSwitch";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/useLocale";
import { useReveal } from "./useReveal";

interface PricingProps {
  onStart: () => void;
}

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
            "reveal mt-12 grid gap-5 md:grid-cols-3",
            visible && "reveal-visible",
          )}
        >
          {TARIFFS.map((tariff, i) => (
            <PlanCard key={tariff.id} tariff={tariff} plan={t.pricing.plans[i]} onStart={onStart} />
          ))}
        </div>

        <div className="mt-8 flex flex-col items-center gap-3 text-sm sm:flex-row sm:justify-center sm:gap-6">
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <GiftIcon className="size-4 text-neon-orange" />
            {t.pricing.trialNote(TARIFF_RULES.trialDays)}
          </span>
          <Link href="/tariflar" className="inline-flex items-center gap-1.5 font-semibold text-foreground transition-colors hover:text-neon-cyan">
            {t.pricing.details}
            <ArrowRightIcon className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function PlanCard({ tariff, plan, onStart }: { tariff: Tariff; plan: Dictionary["pricing"]["plans"][number]; onStart: () => void }) {
  const { t } = useLocale();
  const [index, setIndex] = useState(0);
  const option = tariff.options[index];
  const highlighted = Boolean(tariff.popular);

  return (
    <div
      className={cn(
        "glass relative flex flex-col rounded-2xl p-6 transition-all duration-300",
        highlighted ? "border-neon-orange/50 shadow-[0_0_40px_-12px_rgba(255,94,0,0.5)]" : "hover:border-neon-cyan/40",
      )}
      data-testid={`home-tariff-${tariff.id}`}
    >
      {highlighted && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-neon-orange to-neon-orange-2 px-3 py-1 font-mono text-[0.65rem] font-bold tracking-wide text-background uppercase">
          {t.pricing.ommabop}
        </span>
      )}

      <h3 className="font-display text-lg font-bold text-foreground">{plan.name}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{plan.desc}</p>

      {tariff.options.length > 1 && (
        <div className="mt-4">
          <DurationSwitch
            labels={tariff.options.map((o) => t.pricing.durationLabel(o.durationDays ?? 0))}
            value={index}
            onChange={setIndex}
            ariaLabel={plan.name}
          />
        </div>
      )}

      <div className="mt-5 flex items-baseline gap-1.5">
        <span className="font-mono text-3xl font-bold tracking-tight text-foreground tabular-nums" data-testid="tariff-price">
          {formatPrice(option.price)}
        </span>
        <span className="text-sm text-muted-foreground">{t.pricing.somLabel}</span>
      </div>
      <span className="mt-0.5 text-xs text-muted-foreground">
        {option.durationDays ? t.pricing.period(option.durationDays) : t.pricing.untilPassed}
      </span>

      {plan.inherits && <p className="mt-6 text-sm font-semibold text-neon-orange">{plan.inherits}</p>}
      <ul className={cn("flex flex-1 flex-col gap-2.5", plan.inherits ? "mt-3" : "mt-6")}>
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5 text-sm text-foreground/90">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-neon-orange/15 text-neon-orange">
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
}
