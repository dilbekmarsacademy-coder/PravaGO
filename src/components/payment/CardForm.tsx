"use client";

import { FormEvent, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { CardDetails } from "@/lib/api/payment";

interface CardFormProps {
  onSubmit: (card: CardDetails) => void | Promise<void>;
  disabled?: boolean;
}

type FieldErrors = Partial<Record<"number" | "expiry", string>>;

const CARD_NUMBER_LENGTH = 16;

function formatCardNumber(digits: string): string {
  const groups = digits.match(/.{1,4}/g) ?? [];
  return groups.join(" ");
}

function extractDigits(rawValue: string, maxLength: number): string {
  return rawValue.replace(/\D/g, "").slice(0, maxLength);
}

function luhnCheck(digits: string): boolean {
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = Number(digits[i]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

function formatExpiry(rawValue: string): string {
  const digits = rawValue.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function isExpiryValid(expiry: string): boolean {
  const match = /^(\d{2})\/(\d{2})$/.exec(expiry);
  if (!match) return false;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) return false;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  if (year < currentYear) return false;
  if (year === currentYear && month < currentMonth) return false;
  return true;
}

export default function CardForm({ onSubmit, disabled }: CardFormProps) {
  const [numberDigits, setNumberDigits] = useState("");
  const [expiry, setExpiry] = useState("");
  const [holderName, setHolderName] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(): FieldErrors {
    const next: FieldErrors = {};

    if (numberDigits.length !== CARD_NUMBER_LENGTH || !luhnCheck(numberDigits)) {
      next.number = "Karta raqami noto'g'ri";
    }

    if (!isExpiryValid(expiry)) {
      next.expiry = "Amal qilish muddati noto'g'ri yoki o'tgan";
    }

    return next;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;

    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        numberDigits,
        expiry,
        holderName: holderName.trim() || undefined,
      });
    } finally {
      // Xavfsizlik: karta raqami/muddati yuborilgandan so'ng darhol tozalanadi —
      // hech qayerda (localStorage, cookie, log) saqlanmaydi.
      setNumberDigits("");
      setExpiry("");
      setHolderName("");
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="card-number" className="text-foreground/90">
          Karta raqami
        </Label>
        <Input
          id="card-number"
          value={formatCardNumber(numberDigits)}
          onChange={(e) => {
            setNumberDigits(extractDigits(e.target.value, CARD_NUMBER_LENGTH));
            if (errors.number) setErrors((prev) => ({ ...prev, number: undefined }));
          }}
          placeholder="0000 0000 0000 0000"
          inputMode="numeric"
          autoComplete="cc-number"
          aria-invalid={!!errors.number}
          disabled={disabled || isSubmitting}
          className="font-mono tracking-wider"
        />
        {errors.number && (
          <span className="font-mono text-xs text-destructive">{errors.number}</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="card-expiry" className="text-foreground/90">
            Amal qilish muddati
          </Label>
          <Input
            id="card-expiry"
            value={expiry}
            onChange={(e) => {
              setExpiry(formatExpiry(e.target.value));
              if (errors.expiry) setErrors((prev) => ({ ...prev, expiry: undefined }));
            }}
            placeholder="OO/YY"
            inputMode="numeric"
            autoComplete="cc-exp"
            aria-invalid={!!errors.expiry}
            disabled={disabled || isSubmitting}
            className="font-mono"
          />
          {errors.expiry && (
            <span className="font-mono text-xs text-destructive">{errors.expiry}</span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="card-holder" className="text-foreground/90">
            Karta egasi <span className="text-muted-foreground">(ixtiyoriy)</span>
          </Label>
          <Input
            id="card-holder"
            value={holderName}
            onChange={(e) => setHolderName(e.target.value)}
            placeholder="AZIZ KARIMOV"
            autoComplete="cc-name"
            disabled={disabled || isSubmitting}
          />
        </div>
      </div>

      <Button
        type="submit"
        disabled={disabled || isSubmitting}
        className="glow-orange-hover mt-1 h-auto self-start rounded-full border-0 bg-gradient-to-r from-neon-orange to-neon-orange-2 px-6 py-2.5 text-sm font-bold text-background disabled:opacity-60"
      >
        {isSubmitting ? "Yuborilmoqda..." : "Davom etish"}
      </Button>
    </form>
  );
}
