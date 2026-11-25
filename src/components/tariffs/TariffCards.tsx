"use client";

import { useState } from "react";
import { CheckIcon } from "lucide-react";
import { TARIFFS, formatPrice, onlineTariffId, type Tariff } from "@/config/tariffs";
import type { OnlineTariffs } from "@/lib/api/orders";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/useLocale";
import { cn } from "@/lib/utils";
import BuyButton from "@/components/legal/BuyButton";
import DurationSwitch from "./DurationSwitch";
import PayButtons from "./PayButtons";
import { useOnlineTariffs } from "./useOnlineTariffs";

/**
 * /tariflar va /tolov: uch tarif kartasi, Standartda muddat almashtirgich. Onlayn
 * to'lov yoqilgan bo'lsa (backend PAYMENTS_ENABLED) — Payme tugmasi. Narx va
 * muddat serverdan kelsa, o'shalar ko'rsatiladi (olinadigan summaga teng).
 */
export default function TariffCards() {
  const online = useOnlineTariffs();
  const { t } = useLocale();
  return (
    <div className="grid gap-5 md:grid-cols-3" data-testid="tariff-cards">
      {TARIFFS.map((tariff, i) => (
        <TariffCard key={tariff.id} tariff={tariff} plan={t.pricing.plans[i]} online={online} />
      ))}
    </div>
  );
}

function TariffCard({ tariff, plan, online }: { tariff: Tariff; plan: Dictionary["pricing"]["plans"][number]; online: OnlineTariffs | null }) {
  const { t } = useLocale();
  const [index, setIndex] = useState(0);
  const option = tariff.options[index];
  const id = onlineTariffId(tariff.id, option.durationDays);
  const server = online?.tariffs.find((o) => o.id === id);
  const price = server?.price ?? option.price;
  const days = server ? server.durationDays : option.durationDays;
  return (
    <section
      className={cn("glass relative flex flex-col rounded-2xl p-6", tariff.popular && "border-neon-orange/50 shadow-[0_0_40px_-12px_rgba(255,94,0,0.5)]")}
      data-testid={`tariff-${tariff.id}`}
    >
      {tariff.popular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-neon-orange to-neon-orange-2 px-3 py-1 font-mono text-[0.65rem] font-bold tracking-wide text-background uppercase">
          {t.pricing.ommabop}
        </span>
      )}
      <h2 className="font-display text-xl font-bold text-foreground">{plan.name}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{plan.desc}</p>

      {tariff.options.length > 1 && (
        <div className="mt-4">
          <DurationSwitch labels={tariff.options.map((o) => t.pricing.durationLabel(o.durationDays ?? 0))} value={index} onChange={setIndex} ariaLabel={plan.name} />
        </div>
      )}

      <div className="mt-5 flex items-baseline gap-1.5">
        <span className="font-mono text-3xl font-bold tracking-tight text-foreground tabular-nums" data-testid="tariff-price">
          {formatPrice(price)}
        </span>
        <span className="text-sm text-muted-foreground">{t.pricing.somLabel}</span>
      </div>
      <span className="mt-0.5 text-xs text-muted-foreground" data-testid="tariff-duration">
        {days ? t.pricing.period(days) : t.pricing.untilPassed}
      </span>

      {plan.inherits && <p className="mt-6 text-sm font-semibold text-neon-orange">{plan.inherits}</p>}
      <ul className={cn("flex flex-1 flex-col gap-2.5", plan.inherits ? "mt-3" : "mt-6")}>
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm text-foreground/90">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-neon-orange/15 text-neon-orange">
              <CheckIcon className="size-3" />
            </span>
            {f}
          </li>
        ))}
      </ul>
      <div className="mt-7">
        {online?.enabled && server ? <PayButtons key={server.id} tariff={server.id} /> : <BuyButton />}
      </div>
    </section>
  );
}
