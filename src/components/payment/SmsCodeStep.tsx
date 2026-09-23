"use client";

import { FormEvent, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const RESEND_SECONDS = 60;

interface SmsCodeStepProps {
  phone?: string;
  onVerify: (code: string) => Promise<boolean>;
}

export default function SmsCodeStep({ phone, onVerify }: SmsCodeStepProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isVerifying) return;

    setIsVerifying(true);
    try {
      const valid = await onVerify(code);
      if (!valid) {
        setError("Kod noto'g'ri");
      }
    } finally {
      setIsVerifying(false);
    }
  }

  function handleResend() {
    if (secondsLeft > 0) return;
    setSecondsLeft(RESEND_SECONDS);
    setError(null);
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm text-muted-foreground">
          Kartangizni tasdiqlash uchun bankdan SMS-kod yuborildi
          {phone ? ` (${phone})` : ""}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="card-otp-code" className="text-foreground/90">
            Tasdiqlash kodi
          </Label>
          <Input
            id="card-otp-code"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
              if (error) setError(null);
            }}
            placeholder="000000"
            inputMode="numeric"
            aria-invalid={!!error}
            disabled={isVerifying}
            className="font-mono text-base tracking-[0.3em]"
          />
          {error && <span className="font-mono text-xs text-destructive">{error}</span>}
        </div>

        <div className="flex items-center justify-between gap-3">
          <Button
            type="submit"
            disabled={isVerifying || code.length !== 6}
            className="glow-orange-hover h-auto rounded-full border-0 bg-gradient-to-r from-neon-orange to-neon-orange-2 px-6 py-2.5 text-sm font-bold text-background disabled:opacity-60"
          >
            {isVerifying ? "Tekshirilmoqda..." : "Tasdiqlash"}
          </Button>

          <button
            type="button"
            onClick={handleResend}
            disabled={secondsLeft > 0}
            className="font-mono text-xs text-muted-foreground transition-colors hover:text-neon-cyan disabled:cursor-not-allowed disabled:opacity-50"
          >
            {secondsLeft > 0 ? `Qayta yuborish (${secondsLeft}s)` : "Kodni qayta yuborish"}
          </button>
        </div>
      </form>
    </div>
  );
}
