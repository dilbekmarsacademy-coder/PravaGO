"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClockIcon, GaugeIcon, Loader2Icon, SendIcon, ShieldCheckIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatSom } from "@/config/prices";
import { requestPayment, type Me } from "@/lib/api/account";
import { getRegistration, syncAccount, useRegistration } from "@/lib/registration-store";
import PaymentSummary from "@/components/payment/PaymentSummary";
import PaymentResult from "@/components/payment/PaymentResult";

// Payme/Click hozircha ulanmagan: foydalanuvchi to'lov so'rovini yuboradi,
// administrator to'lovni qabul qilib, admin panelda tasdiqlaydi. Kursga kirish
// faqat backend'dagi tasdiqlangan to'lov bilan ochiladi.

/** Kutilayotgan so'rov holatini qayta tekshirish oralig'i. */
const POLL_MS = 15_000;

type Stage = "loading" | "form" | "pending" | "success" | "blocked" | "error";

export default function TolovPage() {
  const router = useRouter();
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
      await refresh();
    } catch {
      setSendError("So’rovni yuborib bo’lmadi. Qayta urinib ko’ring.");
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
      <div className="mx-auto max-w-xl">
        <div className="mb-8 flex items-center gap-2.5">
          <span className="glow-orange flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-neon-orange to-neon-orange-2 text-background">
            <GaugeIcon className="size-4.5" strokeWidth={2.4} />
          </span>
          <span className="font-display text-sm font-bold tracking-wide text-foreground uppercase">
            PravaTayyor
          </span>
        </div>

        {stage !== "success" && (
          <div className="glass mb-6 flex items-start gap-3 rounded-xl border-neon-amber/30 bg-neon-amber/5 p-4">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-neon-amber" />
            <p className="text-sm text-foreground/90">
              Akkauntingiz to&rsquo;lov tasdiqlangandan so&rsquo;ng faollashadi. To&rsquo;lovgacha o&rsquo;quv
              kontentiga kirish yopiq.
            </p>
          </div>
        )}

        <h1 className="mb-6 font-display text-2xl font-bold tracking-tight text-foreground">
          {stage === "pending" ? "To’lov tasdiqlanishi kutilmoqda" : "To’lovni yakunlang"}
        </h1>

        <div className="flex flex-col gap-6">
          {stage !== "success" && <PaymentSummary examStatus={registration.examStatus} />}

          {stage === "form" && (
            <div className="glass rounded-2xl p-6 sm:p-7">
              <h2 className="mb-2 font-display text-base font-bold text-foreground">To&rsquo;lov so&rsquo;rovi</h2>
              <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                So&rsquo;rov yuborilgach, administrator siz bilan bog&rsquo;lanib to&rsquo;lovni qabul qiladi va kursni
                ochib beradi. Onlayn to&rsquo;lov (Payme, Click) tez orada qo&rsquo;shiladi.
              </p>
              <label htmlFor="payment-note" className="mb-1.5 block text-sm font-medium text-foreground/90">
                Izoh (ixtiyoriy)
              </label>
              <textarea
                id="payment-note"
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 500))}
                placeholder="Masalan: qaysi kartadan o'tkazdingiz yoki qachon qo'ng'iroq qilish qulay"
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
                To&rsquo;lov so&rsquo;rovini yuborish
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
                  <p className="font-display text-base font-bold text-foreground">So&rsquo;rovingiz qabul qilindi</p>
                  {amount !== undefined && <p className="text-sm text-muted-foreground">Summa: {formatSom(amount)}</p>}
                </div>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Administrator to&rsquo;lovni tasdiqlashi bilan kurs ochiladi — bu sahifa o&rsquo;zi yangilanadi.
              </p>
              <Button type="button" variant="outline" onClick={refresh} className="self-start rounded-full">
                Holatni tekshirish
              </Button>
            </div>
          )}

          {stage === "blocked" && (
            <div className="glass rounded-2xl border-destructive/30 p-6 text-sm leading-relaxed text-foreground/90">
              Bu raqam bilan boshqa qurilmada ro&rsquo;yxatdan o&rsquo;tilgan. Shu qurilmani akkauntingizga ulash uchun
              administratorga murojaat qiling.
            </div>
          )}

          {stage === "error" && (
            <div className="glass flex flex-col gap-3 rounded-2xl p-6 text-sm">
              <p className="text-destructive">Server bilan aloqa yo&rsquo;q.</p>
              <Button type="button" variant="outline" onClick={refresh} className="self-start rounded-full">
                Qayta urinish
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
            Xavfsiz to&rsquo;lov
          </div>
          <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
            To&rsquo;lovni amalga oshirish orqali siz{" "}
            <Link href="/#biz-haqimizda" className="underline underline-offset-2 hover:text-neon-cyan">
              ommaviy oferta
            </Link>{" "}
            shartlariga rozilik bildirasiz.
          </p>
          <p className="text-xs text-muted-foreground">
            Savollar bo&rsquo;yicha:{" "}
            <a href="tel:+998712000000" className="text-neon-cyan">
              +998 71 200 00 00
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
