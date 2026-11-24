"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckIcon, ClockIcon, Loader2Icon, XIcon } from "lucide-react";
import { getOrder, type OrderStatus } from "@/lib/api/orders";
import { ApiError, hasSessionToken } from "@/lib/api/session";
import { useLocale } from "@/lib/i18n/useLocale";
import { syncAccount } from "@/lib/registration-store";
import { AppHeader } from "@/components/shared/AppHeader";
import { Button, buttonClasses } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";

const POLL_MS = 3000;
/** Shundan keyin avtomatik so'rov to'xtaydi (ochiq qolgan sahifa bazani band qilmasin) — qo'lda tekshiriladi. */
const MAX_POLLS = 200;

type View = OrderStatus | "loading" | "notFound" | "offline";

/** Payme'dan qaytish sahifasi. Redirect'ga ishonilmaydi — faqat bazadagi buyurtma holati. */
export default function PaymentResultPage() {
  return (
    <Suspense>
      <Result />
    </Suspense>
  );
}

function Result() {
  const orderId = useSearchParams().get("order");
  const { t } = useLocale();
  const p = t.onlinePay;
  const [view, setView] = useState<View>("loading");
  const [run, setRun] = useState(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    let polls = 0;
    async function check() {
      let next: View;
      if (!orderId || !hasSessionToken()) next = "notFound";
      else if (document.hidden) next = "loading";
      else {
        polls++;
        try {
          next = (await getOrder(orderId)).status;
        } catch (err) {
          next = err instanceof ApiError && (err.status === 404 || err.status === 400) ? "notFound" : "offline";
        }
      }
      if (stopped) return;
      if (next !== "loading") setView(next);
      if (next === "PAID") syncAccount().catch(() => undefined);
      if ((next === "PENDING" || next === "offline" || next === "loading") && polls < MAX_POLLS) timer = setTimeout(check, POLL_MS);
    }
    check();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [orderId, run]);

  const recheck = useCallback(() => setRun((n) => n + 1), []);
  const failed = view === "CANCELLED" || view === "notFound";
  const Icon = view === "PAID" ? CheckIcon : failed ? XIcon : view === "loading" ? Loader2Icon : ClockIcon;
  const text = view === "PAID" ? p.paid : view === "CANCELLED" ? p.cancelled : view === "notFound" ? p.notFound : view === "offline" ? p.offline : p.pending;

  return (
    <>
      <AppHeader>
        <span className="truncate text-sm font-semibold text-foreground">{p.resultTitle}</span>
      </AppHeader>
      <main className="mx-auto w-full max-w-xl px-4 py-10 sm:px-6">
        <Card className="flex flex-col items-center gap-4 p-8 text-center" data-testid="payment-result" data-status={view}>
          <Icon className={`size-12 ${view === "PAID" ? "text-success" : failed ? "text-danger" : "text-brand"} ${view === "loading" ? "animate-spin" : ""}`} />
          <div role="status">
            <h1 className="font-display text-xl font-bold text-foreground">{text.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{text.desc}</p>
          </div>
          {view === "PAID" ? (
            <Link href="/kabinet" className={buttonClasses({ size: "md" })}>
              {p.toKabinet}
            </Link>
          ) : failed ? (
            <Link href="/tariflar" className={buttonClasses({ size: "md" })}>
              {p.toTariffs}
            </Link>
          ) : (
            <Button variant="secondary" onClick={recheck}>
              {p.recheck}
            </Button>
          )}
        </Card>
      </main>
    </>
  );
}
