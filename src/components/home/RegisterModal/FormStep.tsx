"use client";

import { FormEvent, ReactNode, useState } from "react";
import { DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n/useLocale";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { RegisterFormData } from "../types";

interface FormStepProps {
  stepLabel: string;
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

export default function FormStep({ stepLabel, initialData, onSubmit }: FormStepProps) {
  const [firstName, setFirstName] = useState(initialData.firstName);
  const [lastName, setLastName] = useState(initialData.lastName);
  const [age, setAge] = useState(initialData.age);
  const [phoneDigits, setPhoneDigits] = useState(
    initialData.phone.replace(/^\+998/, ""),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const { t } = useLocale();
  const errorMessages: Dictionary["registerModal"]["form"]["errors"] = t.registerModal.form.errors;

  function validate(): FieldErrors {
    const next: FieldErrors = {};

    if (!firstName.trim()) {
      next.firstName = errorMessages.firstNameRequired;
    } else if (!NAME_PATTERN.test(firstName.trim())) {
      next.firstName = errorMessages.firstNameInvalid;
    }

    if (!lastName.trim()) {
      next.lastName = errorMessages.lastNameRequired;
    } else if (!NAME_PATTERN.test(lastName.trim())) {
      next.lastName = errorMessages.lastNameInvalid;
    }

    const ageNum = Number(age);
    if (!age.trim() || !Number.isInteger(ageNum)) {
      next.age = errorMessages.ageInvalid;
    } else if (ageNum < 16 || ageNum > 90) {
      next.age = errorMessages.ageRange;
    }

    if (phoneDigits.length !== 9) {
      next.phone = errorMessages.phoneIncomplete;
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
      examStatus: initialData.examStatus,
    };

    // Hech qanday tarmoq so'rovi yo'q — faqat local state va dev log.
    console.log("[FormStep] local submit:", data);
    onSubmit(data);
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="font-mono text-xs tracking-[0.24em] text-neon-orange uppercase">
          {stepLabel}
        </span>
        <DialogTitle className="mt-1 font-display text-2xl font-bold text-foreground">
          {t.registerModal.form.title}
        </DialogTitle>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Field id="firstName" label={t.registerModal.form.firstName} error={errors.firstName}>
          <Input
            id="firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder={t.registerModal.form.firstNamePlaceholder}
            aria-invalid={!!errors.firstName}
          />
        </Field>

        <Field id="lastName" label={t.registerModal.form.lastName} error={errors.lastName}>
          <Input
            id="lastName"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder={t.registerModal.form.lastNamePlaceholder}
            aria-invalid={!!errors.lastName}
          />
        </Field>

        <Field id="age" label={t.registerModal.form.age} error={errors.age}>
          <Input
            id="age"
            value={age}
            onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 2))}
            placeholder={t.registerModal.form.agePlaceholder}
            inputMode="numeric"
            aria-invalid={!!errors.age}
            className="font-mono"
          />
        </Field>

        <Field id="phone" label={t.registerModal.form.phone} error={errors.phone}>
          <Input
            id="phone"
            value={formatPhoneDigits(phoneDigits)}
            onChange={(e) => setPhoneDigits(extractDigits(e.target.value))}
            placeholder={t.registerModal.form.phonePlaceholder}
            inputMode="tel"
            aria-invalid={!!errors.phone}
            className="font-mono"
          />
        </Field>

        <Button
          type="submit"
          className="glow-orange-hover mt-1 h-auto self-start rounded-full border-0 bg-gradient-to-r from-neon-orange to-neon-orange-2 px-6 py-2.5 text-sm font-bold text-background"
        >
          {t.registerModal.form.cta}
        </Button>
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
      <Label htmlFor={id} className="text-foreground/90">
        {label}
      </Label>
      {children}
      {error && <span className="font-mono text-xs text-destructive">{error}</span>}
    </div>
  );
}
