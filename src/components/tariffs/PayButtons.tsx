"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { createOrder, type OnlineTariffId } from "@/lib/api/orders";
import { ApiError } from "@/lib/api/session";
import { useLocale } from "@/lib/i18n/useLocale";
import { getRegistration } from "@/lib/registration-store";

/** "Payme orqali to'lash" (narx serverda — faqat tarif identifikatori yuboriladi); Click va Uzum — tez orada. */
export default function PayButtons({ tariff }: { tariff: OnlineTariffId }) {
  const router = useRouter();
  const { t } = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Payme'dan brauzerning "orqaga" tugmasi bilan qaytilganda (bfcache) tugma bloklanib qolmasin.
    const onShow = (e: PageTransitionEvent) => e.persisted && setBusy(false);
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  async function pay() {
    if (!getRegistration()) return router.push("/");
    setBusy(true);
    setError(null);
    try {
      window.location.assign((await createOrder(tariff)).checkoutUrl);
    } catch (err) {
      setBusy(false);
      const code = err instanceof ApiError ? err.code : undefined;
      if (code === "NOT_REGISTERED") return router.push("/");
      const e = t.onlinePay.errors;
      setError(code === "ALREADY_PAID" || code === "CENTER_ACCOUNT" ? e.alreadyOpen : code === "PAYMENTS_DISABLED" ? e.disabled : e.generic);
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        onClick={pay}
        disabled={busy}
        data-tariff={tariff}
        data-testid="pay-payme"
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-neon-orange to-neon-orange-2 px-6 text-sm font-bold text-background disabled:opacity-60"
      >
        {busy && <Loader2Icon className="size-4 animate-spin" />}
        {t.onlinePay.payme}
      </button>
      {["Click", "Uzum"].map((name) => (
        <button key={name} type="button" disabled className="h-11 w-full cursor-not-allowed rounded-full border border-border bg-foreground/5 px-6 text-sm text-muted-foreground">
          {name} — {t.onlinePay.soon}
        </button>
      ))}
      {error && (
        <p role="alert" className="text-center text-sm text-destructive">
          {error}
        </p>
      )}
      <Link href="/qaytarish" className="text-center text-xs text-muted-foreground underline-offset-2 hover:text-neon-cyan hover:underline">
        {t.footer.links.refund}
      </Link>
    </div>
  );
}
