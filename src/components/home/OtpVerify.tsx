"use client";

import { FormEvent, useState } from "react";
import RetroButton from "@/components/ui/RetroButton";
import RetroCard from "@/components/ui/RetroCard";
import StepShell from "./StepShell";

// TODO: keyinchalik real SMS backend integratsiyasi bilan almashtiriladi (TZ, 4-bo'lim)
const DEV_MOCK_OTP_CODE = "dilbek12345";

interface OtpVerifyProps {
  phone: string;
  onVerified: () => void;
}

export default function OtpVerify({ phone, onVerified }: OtpVerifyProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (code === DEV_MOCK_OTP_CODE) {
      setError(null);
      setSuccess(true);
      onVerified();
    } else {
      setError("Kod noto'g'ri");
    }
  }

  return (
    <StepShell
      title="Telefonni tasdiqlash"
      subtitle={`Sizga SMS-kod yuborildi${phone ? ` (${phone})` : ""}`}
    >
      <RetroCard>
        <form onSubmit={handleSubmit} className="flex flex-col items-center gap-5">
          <label className="w-full">
            <span className="mb-1.5 block text-center font-display text-sm tracking-widest text-ink/80 uppercase">
              Tasdiqlash kodi
            </span>
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                if (success) setSuccess(false);
              }}
              placeholder="Kodni kiriting"
              className={`w-full border-[3px] bg-paper px-4 py-3 text-center font-mono text-xl tracking-[0.2em] text-ink outline-none focus:border-signal-red ${
                error ? "border-signal-red" : "border-asphalt"
              }`}
            />
            {error && (
              <span className="mt-2 block text-center font-mono text-xs text-signal-red">
                {error}
              </span>
            )}
            {success && (
              <span className="mt-2 block text-center font-mono text-xs text-signal-yellow-dark">
                Kod tasdiqlandi
              </span>
            )}
          </label>

          <RetroButton type="submit">Tasdiqlash</RetroButton>
        </form>
      </RetroCard>
    </StepShell>
  );
}
