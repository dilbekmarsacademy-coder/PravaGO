"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GaugeIcon, Loader2Icon, ShieldCheckIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CATEGORY_PRICES } from "@/config/prices";
import {
  chargeCard,
  redirectToHostedCheckout,
  submitCardDetails,
  verifyCardOtp,
  type CardDetails,
  type PaymentMethod,
} from "@/lib/api/payment";
import { getRegistration, markAccountActive, useRegistration } from "@/lib/registration-store";
import PaymentSummary from "@/components/payment/PaymentSummary";
import PaymentMethodSelector from "@/components/payment/PaymentMethodSelector";
import CardForm from "@/components/payment/CardForm";
import SmsCodeStep from "@/components/payment/SmsCodeStep";
import PaymentResult from "@/components/payment/PaymentResult";

type Stage = "select-method" | "card-form" | "card-otp" | "processing" | "success" | "error";

export default function TolovPage() {
  const router = useRouter();
  const registration = useRegistration();
  const [stage, setStage] = useState<Stage>("select-method");
  const [method, setMethod] = useState<PaymentMethod | null>(null);

  useEffect(() => {
    if (!getRegistration()) {
      router.replace("/");
    }
  }, [router]);

  function handleSelectMethod(next: PaymentMethod) {
    setMethod(next);
    setStage(next === "card" ? "card-form" : "select-method");
  }

  async function handleHostedCheckout() {
    if (!method || method === "card" || !registration) return;
    setStage("processing");
    const price = CATEGORY_PRICES[registration.examStatus];
    const result = await redirectToHostedCheckout(method, price.amount);
    if (result.success) {
      markAccountActive();
      setStage("success");
    } else {
      setStage("error");
    }
  }

  async function handleCardSubmit(card: CardDetails) {
    await submitCardDetails(card);
    setStage("card-otp");
  }

  async function handleVerifyOtp(code: string): Promise<boolean> {
    const { valid } = await verifyCardOtp(code);
    if (!valid) return false;

    setStage("processing");
    const result = await chargeCard();
    if (result.success) {
      markAccountActive();
      setStage("success");
    } else {
      setStage("error");
    }
    return true;
  }

  function handleRetry() {
    setStage(method === "card" ? "card-form" : "select-method");
  }

  function handleRedirect() {
    router.push("/kabinet");
  }

  if (!registration) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2Icon className="size-8 animate-spin text-neon-orange" />
      </main>
    );
  }

  const isChoosingMethod = stage === "select-method" || stage === "card-form" || stage === "card-otp";
  const loadingText =
    method === "card" ? "To'lov amalga oshirilmoqda..." : "Provayder sahifasiga yo'naltirilmoqda...";

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
              Akkauntingiz to&rsquo;lovdan so&rsquo;ng faollashadi. To&rsquo;lovgacha o&rsquo;quv
              kontentiga kirish yopiq.
            </p>
          </div>
        )}

        <h1 className="mb-6 font-display text-2xl font-bold tracking-tight text-foreground">
          To&rsquo;lovni yakunlang
        </h1>

        <div className="flex flex-col gap-6">
          <PaymentSummary examStatus={registration.examStatus} />

          {isChoosingMethod && (
            <div className="glass rounded-2xl p-6 sm:p-7">
              <h2 className="mb-4 font-display text-base font-bold text-foreground">
                To&rsquo;lov usulini tanlang
              </h2>

              <PaymentMethodSelector
                selected={method}
                onSelect={handleSelectMethod}
                disabled={stage === "card-otp"}
              />

              {method && method !== "card" && stage === "select-method" && (
                <Button
                  type="button"
                  onClick={handleHostedCheckout}
                  className="glow-orange-hover mt-5 h-auto w-full rounded-full border-0 bg-gradient-to-r from-neon-orange to-neon-orange-2 py-3 text-sm font-bold text-background sm:w-auto sm:px-8"
                >
                  To&rsquo;lovga o&rsquo;tish
                </Button>
              )}

              {method === "card" && stage === "card-form" && (
                <div className="mt-5 border-t border-border pt-5">
                  <CardForm onSubmit={handleCardSubmit} />
                </div>
              )}

              {method === "card" && stage === "card-otp" && (
                <div className="mt-5 border-t border-border pt-5">
                  <SmsCodeStep phone={registration.phone} onVerify={handleVerifyOtp} />
                </div>
              )}
            </div>
          )}

          {(stage === "processing" || stage === "success" || stage === "error") && (
            <PaymentResult
              key={stage}
              status={stage === "processing" ? "loading" : stage}
              loadingText={loadingText}
              onRetry={handleRetry}
              onRedirect={handleRedirect}
            />
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
