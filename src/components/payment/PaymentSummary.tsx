import { CheckIcon } from "lucide-react";
import { CATEGORY_PRICES, COURSE_FEATURES, COURSE_NAME, formatSom } from "@/config/prices";
import type { ExamStatus } from "@/components/home/types";

interface PaymentSummaryProps {
  examStatus: ExamStatus;
}

export default function PaymentSummary({ examStatus }: PaymentSummaryProps) {
  const price = CATEGORY_PRICES[examStatus];

  return (
    <div className="glass rounded-2xl p-6 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="font-mono text-xs tracking-[0.24em] text-neon-orange uppercase">
            Buyurtma xulosasi
          </span>
          <h2 className="mt-1.5 font-display text-lg font-bold text-foreground sm:text-xl">
            {COURSE_NAME}
          </h2>
        </div>
        <span className="shrink-0 rounded-full bg-neon-orange/15 px-3 py-1 font-mono text-xs font-bold whitespace-nowrap text-neon-orange">
          {price.categoryNumber}-toifa
        </span>
      </div>

      <p className="mt-1 text-sm text-muted-foreground">{price.label}</p>

      <ul className="mt-5 flex flex-col gap-2.5 border-t border-border pt-5">
        {COURSE_FEATURES.map((feature) => (
          <li key={feature} className="flex items-center gap-2.5 text-sm text-foreground/90">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-neon-orange/15 text-neon-orange">
              <CheckIcon className="size-3" />
            </span>
            {feature}
          </li>
        ))}
      </ul>

      <div className="mt-6 flex items-baseline justify-between border-t border-border pt-5">
        <span className="text-sm text-muted-foreground">Jami to&rsquo;lov</span>
        <span className="font-mono text-2xl font-bold tracking-tight text-foreground tabular-nums">
          {formatSom(price.amount)}
        </span>
      </div>
    </div>
  );
}
