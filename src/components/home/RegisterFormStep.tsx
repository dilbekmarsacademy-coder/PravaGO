"use client";

import { FormEvent, ReactNode, useState } from "react";
import { DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import RetroButton from "./RetroButton";
import { RegisterFormData } from "./types";

interface RegisterFormStepProps {
  initialData: RegisterFormData;
  onSubmit: (data: RegisterFormData) => void;
}

type FieldErrors = Partial<Record<keyof RegisterFormData, string>>;

const NAME_PATTERN = /^[\p{L}][\p{L}\s'-]*$/u;

function formatPhoneDigits(digits: string): string {
  const groups = [
    digits.slice(0, 2),
    digits.slice(2, 5),
    digits.slice(5, 7),
    digits.slice(7, 9),
  ].filter(Boolean);
  return groups.length ? `+998 ${groups.join(" ")}` : "+998";
}

function extractDigits(rawValue: string): string {
  let digits = rawValue.replace(/\D/g, "");
  if (digits.startsWith("998")) digits = digits.slice(3);
  return digits.slice(0, 9);
}

export default function RegisterFormStep({
  initialData,
  onSubmit,
}: RegisterFormStepProps) {
  const [firstName, setFirstName] = useState(initialData.firstName);
  const [lastName, setLastName] = useState(initialData.lastName);
  const [age, setAge] = useState(initialData.age);
  const [phoneDigits, setPhoneDigits] = useState(
    initialData.phone.replace(/^\+998/, ""),
  );
  const [errors, setErrors] = useState<FieldErrors>({});

  function validate(): FieldErrors {
    const next: FieldErrors = {};

    if (!firstName.trim()) {
      next.firstName = "Ism kiritilishi shart";
    } else if (!NAME_PATTERN.test(firstName.trim())) {
      next.firstName = "Ism faqat harflardan iborat bo'lishi kerak";
    }

    if (!lastName.trim()) {
      next.lastName = "Familiya kiritilishi shart";
    } else if (!NAME_PATTERN.test(lastName.trim())) {
      next.lastName = "Familiya faqat harflardan iborat bo'lishi kerak";
    }

    const ageNum = Number(age);
    if (!age.trim() || !Number.isInteger(ageNum)) {
      next.age = "Yoshni raqamda kiriting";
    } else if (ageNum < 16 || ageNum > 90) {
      next.age = "Yosh 16 dan 90 gacha bo'lishi kerak";
    }

    if (phoneDigits.length !== 9) {
      next.phone = "Telefon raqam to'liq emas (+998 XX XXX XX XX)";
    }

    return next;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const data: RegisterFormData = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      age,
      phone: `+998${phoneDigits}`,
    };

    // Hech qanday tarmoq so'rovi yo'q — faqat local state va dev log.
    console.log("[RegisterFormStep] local submit:", data);
    onSubmit(data);
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="font-mono text-xs uppercase tracking-[0.25em] text-stop">
          Bosqich 2/3
        </span>
        <DialogTitle className="mt-1 font-display text-3xl uppercase tracking-wide text-ink">
          Ro&rsquo;yxatdan o&rsquo;tish
        </DialogTitle>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Field id="firstName" label="Ism" error={errors.firstName}>
          <Input
            id="firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Aziz"
            aria-invalid={!!errors.firstName}
            className="border-ink/50 bg-transparent text-ink placeholder:text-ink/40 focus-visible:border-ink focus-visible:ring-stop/30"
          />
        </Field>

        <Field id="lastName" label="Familiya" error={errors.lastName}>
          <Input
            id="lastName"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Karimov"
            aria-invalid={!!errors.lastName}
            className="border-ink/50 bg-transparent text-ink placeholder:text-ink/40 focus-visible:border-ink focus-visible:ring-stop/30"
          />
        </Field>

        <Field id="age" label="Yosh" error={errors.age}>
          <Input
            id="age"
            value={age}
            onChange={(e) =>
              setAge(e.target.value.replace(/\D/g, "").slice(0, 2))
            }
            placeholder="18"
            inputMode="numeric"
            aria-invalid={!!errors.age}
            className="border-ink/50 bg-transparent font-mono text-ink placeholder:text-ink/40 focus-visible:border-ink focus-visible:ring-stop/30"
          />
        </Field>

        <Field id="phone" label="Telefon raqam" error={errors.phone}>
          <Input
            id="phone"
            value={formatPhoneDigits(phoneDigits)}
            onChange={(e) => setPhoneDigits(extractDigits(e.target.value))}
            placeholder="+998 90 123 45 67"
            inputMode="tel"
            aria-invalid={!!errors.phone}
            className="border-ink/50 bg-transparent font-mono text-ink placeholder:text-ink/40 focus-visible:border-ink focus-visible:ring-stop/30"
          />
        </Field>

        <RetroButton type="submit" surface="paper" className="mt-1 self-start">
          Ro&rsquo;yxatdan o&rsquo;tish
        </RetroButton>
      </form>
    </div>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-ink">
        {label}
      </Label>
      {children}
      {error && (
        <span className="font-mono text-xs text-stop">{error}</span>
      )}
    </div>
  );
}
