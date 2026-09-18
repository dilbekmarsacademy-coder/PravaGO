"use client";

import { FormEvent, useState } from "react";
import { DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import RetroButton from "./RetroButton";

// TODO: keyinchalik real SMS backend integratsiyasi bilan almashtiriladi
const DEV_MOCK_OTP_CODE = "dilbek12345";

interface OtpStepProps {
  phone: string;
  onVerified: () => void;
}

export default function OtpStep({ phone, onVerified }: OtpStepProps) {
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
        <span className="font-mono text-xs uppercase tracking-[0.25em] text-stop">
          Bosqich 4/4
        </span>
        <DialogTitle className="mt-1 font-display text-3xl uppercase tracking-wide text-ink">
          Telefonni tasdiqlash
        </DialogTitle>
        <p className="mt-1 text-sm text-ink/70">
          Sizga SMS-kod yuborildi{phone ? ` (${phone})` : ""}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="otp-code" className="text-ink">
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
            className="border-ink/50 bg-transparent font-mono text-lg tracking-[0.15em] text-ink placeholder:text-ink/40 focus-visible:border-ink focus-visible:ring-stop/30"
          />
          {error && (
            <span className="font-mono text-xs text-stop">{error}</span>
          )}
        </div>

        <RetroButton type="submit" surface="paper" className="self-start">
          Tasdiqlash
        </RetroButton>
      </form>
    </div>
  );
}
