"use client";

import { CreditCardIcon, LandmarkIcon, SmartphoneIcon, WalletIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PaymentMethod } from "@/lib/api/payment";

interface MethodOption {
  value: PaymentMethod;
  label: string;
  hint: string;
  icon: typeof CreditCardIcon;
}

const METHODS: MethodOption[] = [
  { value: "click", label: "Click", hint: "Ilova orqali to'lov", icon: SmartphoneIcon },
  { value: "payme", label: "Payme", hint: "Ilova orqali to'lov", icon: WalletIcon },
  { value: "uzum", label: "Uzum Bank", hint: "Ilova orqali to'lov", icon: LandmarkIcon },
  { value: "card", label: "Bank kartasi orqali", hint: "Uzcard / Humo / Visa", icon: CreditCardIcon },
];

interface PaymentMethodSelectorProps {
  selected: PaymentMethod | null;
  onSelect: (method: PaymentMethod) => void;
  disabled?: boolean;
}

export default function PaymentMethodSelector({
  selected,
  onSelect,
  disabled,
}: PaymentMethodSelectorProps) {
  return (
    <div
      className="grid gap-3 sm:grid-cols-2"
      role="radiogroup"
      aria-label="To'lov usuli"
    >
      {METHODS.map((method) => {
        const isSelected = selected === method.value;
        const Icon = method.icon;
        return (
          <button
            key={method.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => onSelect(method.value)}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              isSelected
                ? "border-neon-orange/50 bg-foreground/[0.06]"
                : "border-border bg-foreground/[0.02] hover:border-foreground/20",
            )}
          >
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-full",
                isSelected ? "bg-neon-orange/15 text-neon-orange" : "bg-foreground/5 text-muted-foreground",
              )}
            >
              <Icon className="size-4.5" />
            </span>
            <span className="flex flex-col">
              <span className="font-display text-sm font-bold text-foreground">
                {method.label}
              </span>
              <span className="text-xs text-muted-foreground">{method.hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
