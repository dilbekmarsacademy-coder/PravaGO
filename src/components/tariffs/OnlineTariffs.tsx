"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { formatPrice } from "@/config/tariffs";
import { createOrder, getOnlineTariffs, type OnlineTariffId, type OnlineTariffs as Data } from "@/lib/api/orders";
import { ApiError } from "@/lib/api/session";
import { useLocale } from "@/lib/i18n/useLocale";
import { getRegistration } from "@/lib/registration-store";

const NAMES: Record<OnlineTariffId, string> = { STANDARD: "Standart", PRO: "Pro", MAX: "Max" };

/**
 * Onlayn to'lov yoqilgan bo'lsa (backend PAYMENTS_ENABLED) — serverdagi narxlar va
 * Payme tugmasi; aks holda `fallback` (hozirgi kartalar). Ko'rsatilgan narx
 * doim olinadigan narxga teng.
 */
export default function OnlineTariffs({ fallback }: { fallback: ReactNode }) {
  const router = useRouter();
  const { t } = useLocale();
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState<OnlineTariffId | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getOnlineTariffs().then(setData).catch(() => undefined);
  }, []);

  useEffect(() => {
    // Payme'dan brauzerning "orqaga" tugmasi bilan qaytilganda (bfcache) tugma bloklanib qolmasin.
    const onShow = (e: PageTransitionEvent) => e.persisted && setBusy(null);
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  if (!data?.enabled) return <>{fallback}</>;

  async function pay(id: OnlineTariffId) {
    if (!getRegistration()) return router.push("/");
    setBusy(id);
    setError(null);
    try {
      window.location.assign((await createOrder(id)).checkoutUrl);
    } catch (err) {
      setBusy(null);
      const code = err instanceof ApiError ? err.code : undefined;
      if (code === "NOT_REGISTERED") return router.push("/");
      setError(
        code === "ALREADY_PAID" || code === "CENTER_ACCOUNT" ? t.onlinePay.errors.alreadyOpen : code === "PAYMENTS_DISABLED" ? t.onlinePay.errors.disabled : t.onlinePay.errors.generic,
      );
    }
  }

  return (
    <div>
      <div className="grid gap-5 md:grid-cols-3" data-testid="online-tariffs">
        {data.tariffs.map((tariff) => (
          <section key={tariff.id} className="glass flex flex-col rounded-2xl p-6" data-testid={`online-tariff-${tariff.id}`}>
            <h2 className="font-display text-xl font-bold text-foreground">{NAMES[tariff.id]}</h2>
            <div className="mt-5 flex items-baseline gap-1.5">
              <span className="font-mono text-3xl font-bold tracking-tight text-foreground tabular-nums">{formatPrice(tariff.price)}</span>
              <span className="text-sm text-muted-foreground">{t.pricing.somLabel}</span>
            </div>
            <span className="mt-0.5 text-xs text-muted-foreground">{t.pricing.period(tariff.durationDays)}</span>
            <div className="mt-7 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => pay(tariff.id)}
                disabled={busy !== null}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-neon-orange to-neon-orange-2 px-6 text-sm font-bold text-background disabled:opacity-60"
                data-testid={`pay-payme-${tariff.id}`}
              >
                {busy === tariff.id && <Loader2Icon className="size-4 animate-spin" />}
                {t.onlinePay.payme}
              </button>
              {["Click", "Uzum"].map((name) => (
                <button key={name} type="button" disabled className="h-11 w-full cursor-not-allowed rounded-full border border-border bg-foreground/5 px-6 text-sm text-muted-foreground">
                  {name} — {t.onlinePay.soon}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-4 text-center text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
