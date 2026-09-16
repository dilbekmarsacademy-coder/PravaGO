"use client";

import { FormEvent, ReactNode, useState } from "react";
import RetroButton from "@/components/ui/RetroButton";
import RetroCard from "@/components/ui/RetroCard";
import StepShell from "./StepShell";
import { RegisterFormData } from "./types";

interface RegisterFormProps {
  onNext: (data: RegisterFormData) => void;
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

export default function RegisterForm({ onNext }: RegisterFormProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [age, setAge] = useState("");
  const [phoneDigits, setPhoneDigits] = useState("");
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

    // No network request — form data stays local for now.
    console.log("[RegisterForm] local submit:", data);
    onNext(data);
  }

  return (
    <StepShell
      title="Ro'yxatdan o'tish"
      subtitle="Ma'lumotlaringiz faqat shu qurilmada saqlanadi"
    >
      <RetroCard>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          <Field label="Ism" error={errors.firstName}>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Aziz"
              className={inputClass(!!errors.firstName)}
            />
          </Field>

          <Field label="Familiya" error={errors.lastName}>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Karimov"
              className={inputClass(!!errors.lastName)}
            />
          </Field>

          <Field label="Yosh" error={errors.age}>
            <input
              value={age}
              onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 2))}
              placeholder="18"
              inputMode="numeric"
              className={`${inputClass(!!errors.age)} font-mono`}
            />
          </Field>

          <Field label="Telefon raqam" error={errors.phone}>
            <input
              value={formatPhoneDigits(phoneDigits)}
              onChange={(e) => setPhoneDigits(extractDigits(e.target.value))}
              placeholder="+998 90 123 45 67"
              inputMode="tel"
              className={`${inputClass(!!errors.phone)} font-mono`}
            />
          </Field>

          <RetroButton type="submit" className="mt-2 self-center">
            Davom etish
          </RetroButton>
        </form>
      </RetroCard>
    </StepShell>
  );
}

function inputClass(hasError: boolean) {
  return `w-full border-[3px] bg-paper px-4 py-3 text-lg text-ink outline-none placeholder:text-ink/30 focus:border-signal-red ${
    hasError ? "border-signal-red" : "border-asphalt"
  }`;
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-display text-sm tracking-widest text-ink/80 uppercase">
        {label}
      </span>
      {children}
      {error && (
        <span className="mt-1 block font-mono text-xs text-signal-red">
          {error}
        </span>
      )}
    </label>
  );
}
