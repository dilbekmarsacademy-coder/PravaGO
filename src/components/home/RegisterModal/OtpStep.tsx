"use client";

import { FormEvent, useState } from "react";
import { DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

// TODO: keyinchalik real SMS backend integratsiyasi bilan almashtiriladi
const DEV_MOCK_OTP_CODE = "dilbek12345";

interface OtpStepProps {
  stepLabel: string;
  phone: string;
  onVerified: () => void;
}

export default function OtpStep({ stepLabel, phone, onVerified }: OtpStepProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (code === DEV_MOCK_OTP_CODE) {
      setError(null);
      onVerified();
    } else {
      setError("Kod noto'g'ri");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="font-mono text-xs tracking-[0.24em] text-neon-orange uppercase">
          {stepLabel}
        </span>
        <DialogTitle className="mt-1 font-display text-2xl font-bold text-foreground">
          Telefonni tasdiqlash
        </DialogTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Sizga SMS-kod yuborildi{phone ? ` (${phone})` : ""}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="otp-code" className="text-foreground/90">
            Tasdiqlash kodi
          </Label>
          <Input
            id="otp-code"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Kodni kiriting"
            aria-invalid={!!error}
            className="font-mono text-base tracking-[0.1em]"
          />
          {error && <span className="font-mono text-xs text-destructive">{error}</span>}
        </div>

        <Button
          type="submit"
          className="glow-orange-hover h-auto self-start rounded-full border-0 bg-gradient-to-r from-neon-orange to-neon-orange-2 px-6 py-2.5 text-sm font-bold text-background"
        >
          Tasdiqlash
        </Button>
      </form>
    </div>
  );
}
