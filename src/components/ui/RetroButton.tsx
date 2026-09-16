"use client";

import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger";

interface RetroButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-signal-yellow text-asphalt shadow-[4px_4px_0_0_#1c1b19] active:shadow-[1px_1px_0_0_#1c1b19]",
  secondary:
    "bg-paper text-asphalt shadow-[4px_4px_0_0_#1c1b19] active:shadow-[1px_1px_0_0_#1c1b19]",
  danger:
    "bg-signal-red text-paper shadow-[4px_4px_0_0_#1c1b19] active:shadow-[1px_1px_0_0_#1c1b19]",
};

export default function RetroButton({
  variant = "primary",
  className = "",
  children,
  ...rest
}: RetroButtonProps) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 border-[3px] border-asphalt px-6 py-3 font-display text-xl tracking-wider uppercase transition-all duration-100 active:translate-x-[3px] active:translate-y-[3px] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-[4px_4px_0_0_#1c1b19] disabled:active:translate-x-0 disabled:active:translate-y-0 ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
