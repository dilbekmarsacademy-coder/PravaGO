"use client";

import Link from "next/link";
import { LockIcon } from "lucide-react";
import { useLocale } from "@/lib/i18n/useLocale";

/** Onlayn to'lov o'chiq (backend PAYMENTS_ENABLED=false) — o'chirilgan tugma. Yoqilganda: tariffs/PayButtons. */
export default function BuyButton() {
  const { t } = useLocale();
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled
        className="inline-flex h-11 w-full cursor-not-allowed items-center justify-center gap-2 rounded-full border border-border bg-foreground/5 px-6 text-sm font-bold text-muted-foreground"
        data-testid="buy-disabled"
      >
        <LockIcon className="size-4" />
        {t.onlinePay.buy}
      </button>
      <span className="text-center text-xs text-muted-foreground">{t.onlinePay.buySoon}</span>
      <Link href="/qaytarish" className="text-center text-xs text-muted-foreground underline-offset-2 hover:text-neon-cyan hover:underline">
        {t.footer.links.refund}
      </Link>
    </div>
  );
}
