import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface RetroButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  surface?: "dark" | "paper";
}

const SURFACE_CLASSES: Record<NonNullable<RetroButtonProps["surface"]>, string> = {
  dark: "border-paper bg-primary text-ink shadow-[6px_6px_0_0_var(--stop)] hover:brightness-[1.03]",
  paper: "border-ink bg-primary text-ink shadow-[5px_5px_0_0_var(--stop)] hover:brightness-[1.03]",
};

export default function RetroButton({
  surface = "dark",
  className,
  ...props
}: RetroButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 border-[3px] px-7 py-3.5 font-display text-lg uppercase tracking-[0.08em] transition-all duration-100 active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:pointer-events-none disabled:translate-x-0 disabled:translate-y-0 disabled:opacity-40 disabled:shadow-none",
        SURFACE_CLASSES[surface],
        className,
      )}
      {...props}
    />
  );
}
