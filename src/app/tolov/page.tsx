"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClockIcon, Loader2Icon, SendIcon, ShieldCheckIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPrice, tariffById } from "@/config/tariffs";
import { useLocale } from "@/lib/i18n/useLocale";
import { requestPayment, type Me } from "@/lib/api/account";
import { track } from "@/lib/analytics";
import { getRegistration, syncAccount, useRegistration } from "@/lib/registration-store";
import TariffCards from "@/components/tariffs/TariffCards";
import PaymentResult from "@/components/payment/PaymentResult";
import { Logo } from "@/components/shared/Logo";

// Tarif tanlanib Payme orqali to'lanadi (backend PAYMENTS_ENABLED). Zaxira yo'l:
// administratorga so'rov — u to'lovni qabul qilib, admin panelda tasdiqlaydi.
// Kursga kirish faqat backend'dagi holat bilan ochiladi.

/** Kutilayotgan so'rov holatini qayta tekshirish oralig'i. */
const POLL_MS = 15_000;

type Stage = "loading" | "form" | "pending" | "success" | "blocked" | "error";

export default function TolovPage() {
  const router = useRouter();
  const { t } = useLocale();
  const p = t.onlinePay.tolov;
  const som = (n: number) => `${formatPrice(n)} ${t.pricing.somLabel}`;
  const registration = useRegistration();
  const [stage, setStage] = useState<Stage>("loading");
  const [me, setMe] = useState<Me | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await syncAccount();
      setMe(next);
      if (!next.registered) setStage("blocked");
      else if (next.access) setStage("success");
      else setStage(next.payment.status === "PENDING" ? "pending" : "form");
    } catch {
      setStage("error");
    }
  }, []);

  useEffect(() => {
    if (!getRegistration()) {
      router.replace("/");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [router, refresh]);

  useEffect(() => {
    if (stage !== "pending") return;
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [stage, refresh]);

  async function handleSend() {
    setSending(true);
    setSendError(null);
    try {
      await requestPayment(note.trim() || undefined);
      track("payment_request");
      await refresh();
    } catch {
      setSendError(p.sendError);
    } finally {
      setSending(false);
    }
  }

  if (!registration || stage === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2Icon className="size-8 animate-spin text-neon-orange" />
      </main>
    );
  }

  const amount = me?.payment.amount;

  return (
    <main className="min-h-screen bg-background px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/" aria-label="PravaIshonch" className="mb-8 flex w-fit items-center">
          <Logo priority className="h-10" />
        </Link>

        {stage !== "success" && (
          <div className="glass mb-6 flex items-start gap-3 rounded-xl border-neon-amber/30 bg-neon-amber/5 p-4">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-neon-amber" />
            <p className="text-sm text-foreground/90">
              {p.notice}
            </p>
          </div>
        )}

        <h1 className="mb-6 font-display text-2xl font-bold tracking-tight text-foreground">
          {stage === "pending" ? p.pendingTitle : p.title}
        </h1>

        <div className="flex flex-col gap-6">
          {(stage === "form" || stage === "pending") && (
            <div className="flex flex-col gap-4">
              <TariffCards />
              <Link href="/tariflar" className="self-center text-sm font-semibold text-neon-cyan underline-offset-2 hover:underline" data-testid="tolov-tariffs-link">
                {p.allTariffs}
              </Link>
            </div>
          )}

          {stage === "form" && (
            <div className="glass rounded-2xl p-6 sm:p-7">
              <h2 className="mb-2 font-display text-base font-bold text-foreground">{p.manualTitle}</h2>
              <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                {p.manualDesc(som(tariffById("premium").options[0].price))}
              </p>
              <label htmlFor="payment-note" className="mb-1.5 block text-sm font-medium text-foreground/90">
                {p.noteLabel}
              </label>
              <textarea
                id="payment-note"
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 500))}
                placeholder={p.notePlaceholder}
                className="min-h-20 w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
              />
              {sendError && <p className="mt-2 text-sm text-destructive">{sendError}</p>}
              <Button
                type="button"
                onClick={handleSend}
                disabled={sending}
                className="glow-orange-hover mt-5 h-auto w-full rounded-full border-0 bg-gradient-to-r from-neon-orange to-neon-orange-2 py-3 text-sm font-bold text-background sm:w-auto sm:px-8"
              >
                {sending ? <Loader2Icon className="size-4 animate-spin" /> : <SendIcon className="size-4" />}
                {p.send}
              </Button>
            </div>
          )}

          {stage === "pending" && (
            <div className="glass flex flex-col gap-3 rounded-2xl p-6 sm:p-7">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-neon-amber/15 text-neon-amber">
                  <ClockIcon className="size-5" />
                </span>
                <div>
                  <p className="font-display text-base font-bold text-foreground">{p.requestAccepted}</p>
                  {amount !== undefined && <p className="text-sm text-muted-foreground">{p.amount}: {som(amount)}</p>}
                </div>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {p.pendingDesc}
              </p>
              <Button type="button" variant="outline" onClick={refresh} className="self-start rounded-full">
                {t.onlinePay.recheck}
              </Button>
            </div>
          )}

          {stage === "blocked" && (
            <div className="glass rounded-2xl border-destructive/30 p-6 text-sm leading-relaxed text-foreground/90">
              {p.phoneTaken}
            </div>
          )}

          {stage === "error" && (
            <div className="glass flex flex-col gap-3 rounded-2xl p-6 text-sm">
              <p className="text-destructive">{p.noConnection}</p>
              <Button type="button" variant="outline" onClick={refresh} className="self-start rounded-full">
                {p.retry}
              </Button>
            </div>
          )}

          {stage === "success" && (
            <PaymentResult status="success" loadingText="" onRetry={refresh} onRedirect={() => router.push("/kabinet")} />
          )}
        </div>

        <div className="mt-8 flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-1.5 font-mono text-xs tracking-wide text-neon-green uppercase">
            <ShieldCheckIcon className="size-3.5" />
            {p.secure}
          </div>
          <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
            {p.offerPre}{" "}
            <Link href="/oferta" className="underline underline-offset-2 hover:text-neon-cyan">
              {p.offerLink}
            </Link>{" "}
            {p.offerPost}
          </p>
          <p className="text-xs text-muted-foreground">
            {p.questions}{" "}
            <a href="tel:+998712000000" className="text-neon-cyan">
              +998 71 200 00 00
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
