"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Section from "./Section";

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
    <Section
      index="05"
      title="Telefonni tasdiqlash"
      subtitle={`Sizga SMS-kod yuborildi${phone ? ` (${phone})` : ""}`}
    >
      <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="otp-code">Tasdiqlash kodi</Label>
          <Input
            id="otp-code"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              if (success) setSuccess(false);
            }}
            placeholder="Kodni kiriting"
            aria-invalid={!!error}
            className="font-mono text-lg tracking-[0.15em]"
          />
          {error && (
            <span className="font-mono text-xs text-destructive">
              {error}
            </span>
          )}
          {success && (
            <span className="font-mono text-xs text-primary">
              Kod tasdiqlandi
            </span>
          )}
        </div>

        <Button type="submit" className="self-start">
          Tasdiqlash
        </Button>
      </form>
    </Section>
  );
}
