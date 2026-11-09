"use client";

import { useState } from "react";
import { CheckIcon } from "lucide-react";
import { TARIFFS, formatPrice, inheritsLabel, type Tariff } from "@/config/tariffs";
import { cn } from "@/lib/utils";
import BuyButton from "@/components/legal/BuyButton";
import DurationSwitch from "./DurationSwitch";

/** /tariflar: uch tarif kartasi (teng balandlik), Standartda muddat almashtirgich. */
export default function TariffCards() {
  return (
    <div className="grid gap-5 md:grid-cols-3" data-testid="tariff-cards">
      {TARIFFS.map((t) => (
        <TariffCard key={t.id} tariff={t} />
      ))}
    </div>
  );
}

function TariffCard({ tariff }: { tariff: Tariff }) {
  const [index, setIndex] = useState(0);
  const option = tariff.options[index];
  const inherits = inheritsLabel(tariff);
  return (
    <section
      className={cn("glass relative flex flex-col rounded-2xl p-6", tariff.popular && "border-neon-orange/50 shadow-[0_0_40px_-12px_rgba(255,94,0,0.5)]")}
      data-testid={`tariff-${tariff.id}`}
    >
      {tariff.popular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-neon-orange to-neon-orange-2 px-3 py-1 font-mono text-[0.65rem] font-bold tracking-wide text-background uppercase">
          Mashhur
        </span>
      )}
      <h2 className="font-display text-xl font-bold text-foreground">{tariff.name}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{tariff.summary}</p>

      {tariff.options.length > 1 && (
        <div className="mt-4">
          <DurationSwitch labels={tariff.options.map((o) => o.label)} value={index} onChange={setIndex} ariaLabel={`${tariff.name}: muddat`} />
        </div>
      )}

      <div className="mt-5 flex items-baseline gap-1.5">
        <span className="font-mono text-3xl font-bold tracking-tight text-foreground tabular-nums" data-testid="tariff-price">
          {formatPrice(option.price)}
        </span>
        <span className="text-sm text-muted-foreground">soʻm</span>
      </div>
      <span className="mt-0.5 text-xs text-muted-foreground" data-testid="tariff-duration">
        {option.durationDays ? `${option.label} (${option.durationDays} kun)` : `Muddat: ${option.label.toLowerCase()}`}
      </span>

      {inherits && <p className="mt-6 text-sm font-semibold text-neon-orange">{inherits}</p>}
      {!inherits && <h3 className="mt-6 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Nima kiradi</h3>}
      <ul className="mt-3 flex flex-1 flex-col gap-2.5">
        {tariff.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm text-foreground/90">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-neon-orange/15 text-neon-orange">
              <CheckIcon className="size-3" />
            </span>
            {f}
          </li>
        ))}
      </ul>
      <div className="mt-7">
        <BuyButton tariff={tariff.id} durationDays={option.durationDays} highlighted={tariff.popular} />
      </div>
    </section>
  );
}
